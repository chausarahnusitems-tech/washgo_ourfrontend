-- Let the booking RPCs accept the plate explicitly (p_expected_plate) instead of
-- relying on a snapshot of profiles.vehicle at insert time. This lets the booking
-- form record the entered plate WITHOUT having to persist it to the profile first
-- (removing a fragile pre-write + restore dance and its race). When the param is
-- null the BEFORE-INSERT trigger still fills expected_plate from the profile, so
-- existing callers are unaffected.

drop function if exists public.create_booking(text, date, text, text[], boolean, text);
create or replace function public.create_booking(p_shop_id text, p_date date, p_slot text, p_service_ids text[], p_use_voucher boolean default false, p_coupon_code text default null, p_expected_plate text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_subtotal integer;
  v_resolved integer;
  v_discount integer := 0;
  v_coupon_discount integer := 0;
  v_coupon public.coupons%rowtype;
  v_code text := nullif(btrim(coalesce(p_coupon_code, '')), '');
  v_total integer;
  v_free boolean := false;
  v_stamp boolean := false;
  v_booking uuid;
  v_pct integer;
  v_closed boolean;
  v_cap integer;
  v_count integer;
  v_weekly jsonb;
  v_open time;
  v_close time;
  v_dow text := (extract(dow from p_date)::int)::text;
  v_member boolean;
  v_standard text;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'no services selected';
  end if;
  if not exists (
    select 1 from public.shops where id = p_shop_id and status = 'approved' and published
  ) then
    raise exception 'shop not available';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_shop_id || p_date::text || p_slot)::bigint);

  select coalesce(o.is_closed, false),
         coalesce(o.max_cars_per_slot, s.max_cars_per_slot),
         s.weekly_hours, s.open_time, s.close_time
    into v_closed, v_cap, v_weekly, v_open, v_close
  from public.shops s
  left join public.shop_slot_overrides o on o.shop_id = s.id and o.date = p_date
  where s.id = p_shop_id;
  if v_closed or public.is_weekly_closed(v_weekly, p_date) then
    raise exception 'shop closed on this date';
  end if;

  if v_weekly is not null and (v_weekly -> v_dow) is not null then
    v_open := coalesce(nullif(v_weekly -> v_dow ->> 'open', '')::time, v_open);
    v_close := coalesce(nullif(v_weekly -> v_dow ->> 'close', '')::time, v_close);
  end if;
  if v_open is not null and v_close is not null and p_slot ~ '^[0-9]{1,2}:[0-9]{2}$' then
    if p_slot::time < v_open or p_slot::time >= v_close then
      raise exception 'slot outside opening hours';
    end if;
  end if;

  select count(*) into v_count
  from public.bookings
  where shop_id = p_shop_id and scheduled_date = p_date and slot_time = p_slot
    and status <> 'cancelled'
    and (status <> 'pending_payment' or created_at > now() - interval '30 minutes');
  if v_count >= coalesce(v_cap, 1) then
    raise exception 'slot full';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;

  select coalesce((select sum(price) from public.services where id = any (p_service_ids)), 0)
       + coalesce((select sum(price) from public.shop_custom_services
                    where shop_id = p_shop_id and id::text = any (p_service_ids)), 0)
    into v_subtotal;
  select count(distinct r.sid) into v_resolved from (
    select id::text as sid from public.services where id = any (p_service_ids)
    union
    select id::text from public.shop_custom_services where shop_id = p_shop_id and id::text = any (p_service_ids)
  ) r;
  if v_resolved <> (select count(distinct x) from unnest(p_service_ids) x) then
    raise exception 'unknown services';
  end if;
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  v_member := v_profile.selected_plan = 'premium'
              and coalesce(v_profile.membership_until, date '1900-01-01') >= current_date;
  if v_member then
    select coalesce(discount_percent, 0) into v_pct from public.plans where id = 'premium';
    if coalesce(v_pct, 0) > 0 then
      v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
    end if;
  end if;

  if v_code is not null then
    select * into v_coupon from public.coupons
      where code = upper(v_code)
        and (expires_at is null or expires_at >= current_date)
      for update;
    if not found then raise exception 'invalid or expired code'; end if;
    if v_coupon.members_only and not v_member then
      raise exception 'coupon requires membership';
    end if;
    if v_coupon.max_uses is not null
       and (
         (select count(*) from public.coupon_redemptions where coupon_code = v_coupon.code)
         + (select count(*) from public.bookings
              where coupon_code = v_coupon.code and status = 'pending_payment'
                and created_at > now() - interval '30 minutes')
       ) >= v_coupon.max_uses then
      raise exception 'coupon usage limit reached';
    end if;
    if v_coupon.per_user_limit is not null
       and (
         (select count(*) from public.coupon_redemptions where coupon_code = v_coupon.code and user_id = v_uid)
         + (select count(*) from public.bookings
              where coupon_code = v_coupon.code and user_id = v_uid and status = 'pending_payment'
                and created_at > now() - interval '30 minutes')
       ) >= v_coupon.per_user_limit then
      raise exception 'coupon already used';
    end if;
    if coalesce(v_coupon.amount_off, 0) > 0 then
      v_coupon_discount := v_coupon.amount_off;
    elsif coalesce(v_coupon.percent, 0) > 0 then
      v_coupon_discount := round((v_subtotal * v_coupon.percent / 100.0) / 1000) * 1000;
    end if;
    v_coupon_discount := least(v_coupon_discount, greatest(0, v_subtotal - v_discount));
  end if;

  v_total := greatest(0, v_subtotal - v_discount - v_coupon_discount);

  if p_use_voucher then
    if not v_profile.voucher then raise exception 'no voucher available'; end if;
    select standard_service_id into v_standard from public.shops where id = p_shop_id;
    if v_standard is null or not (v_standard = any (p_service_ids)) then
      raise exception 'voucher requires a standard car wash';
    end if;
    v_free := true;
    v_total := greatest(0, v_total - coalesce(
      (select price from public.services where id = v_standard),
      (select price from public.shop_custom_services where id::text = v_standard and shop_id = p_shop_id),
      0));
  end if;

  if v_profile.funds < v_total then
    raise exception 'insufficient funds';
  end if;

  insert into public.bookings
    (user_id, shop_id, scheduled_date, slot_time, plan_id, total,
     free_wash, earned_stamp, status, coupon_code, expected_plate)
  values
    (v_uid, p_shop_id, p_date, p_slot, v_profile.selected_plan, v_total,
     v_free, false, 'upcoming',
     case when v_coupon_discount > 0 then v_coupon.code else null end,
     nullif(btrim(p_expected_plate), ''))
  returning id into v_booking;

  insert into public.booking_services (booking_id, service_id, unit_price)
  select v_booking, s.id, s.price
  from public.services s where s.id = any (p_service_ids);

  insert into public.booking_services (booking_id, custom_service_id, custom_name, unit_price)
  select v_booking, c.id, c.name, c.price
  from public.shop_custom_services c
  where c.shop_id = p_shop_id and c.id::text = any (p_service_ids);

  if v_coupon_discount > 0 then
    insert into public.coupon_redemptions (coupon_code, user_id, booking_id)
    values (v_coupon.code, v_uid, v_booking);
  end if;

  if v_free then
    if v_total > 0 then
      insert into public.wallet_transactions (user_id, booking_id, amount, kind)
      values (v_uid, v_booking, -v_total, 'charge');
    end if;
    update public.profiles
    set voucher = false, pending_voucher = false, stamps = 0, funds = funds - v_total
    where id = v_uid;
  else
    if v_total > 0 then
      insert into public.wallet_transactions (user_id, booking_id, amount, kind)
      values (v_uid, v_booking, -v_total, 'charge');
    end if;
    update public.profiles set funds = funds - v_total where id = v_uid;
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  return jsonb_build_object(
    'booking_id', v_booking, 'total', v_total, 'free_wash', v_free,
    'earned_stamp', v_stamp, 'funds', v_profile.funds,
    'stamps', v_profile.stamps, 'voucher', v_profile.voucher,
    'coupon_discount', v_coupon_discount
  );
end;
$function$;
revoke execute on function public.create_booking(text, date, text, text[], boolean, text, text) from public, anon;
grant execute on function public.create_booking(text, date, text, text[], boolean, text, text) to authenticated, service_role;

drop function if exists public.create_pending_booking(text, date, text, text[], text);
create or replace function public.create_pending_booking(p_shop_id text, p_date date, p_slot text, p_service_ids text[], p_coupon_code text default null, p_expected_plate text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_subtotal integer;
  v_resolved integer;
  v_discount integer := 0;
  v_coupon_discount integer := 0;
  v_coupon public.coupons%rowtype;
  v_code text := nullif(btrim(coalesce(p_coupon_code, '')), '');
  v_total integer;
  v_booking uuid;
  v_pct integer;
  v_closed boolean;
  v_cap integer;
  v_count integer;
  v_weekly jsonb;
  v_open time;
  v_close time;
  v_dow text := (extract(dow from p_date)::int)::text;
  v_member boolean;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'no services selected';
  end if;
  if not exists (
    select 1 from public.shops where id = p_shop_id and status = 'approved' and published
  ) then
    raise exception 'shop not available';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_shop_id || p_date::text || p_slot)::bigint);

  select coalesce(o.is_closed, false),
         coalesce(o.max_cars_per_slot, s.max_cars_per_slot),
         s.weekly_hours, s.open_time, s.close_time
    into v_closed, v_cap, v_weekly, v_open, v_close
  from public.shops s
  left join public.shop_slot_overrides o on o.shop_id = s.id and o.date = p_date
  where s.id = p_shop_id;
  if v_closed or public.is_weekly_closed(v_weekly, p_date) then
    raise exception 'shop closed on this date';
  end if;

  if v_weekly is not null and (v_weekly -> v_dow) is not null then
    v_open := coalesce(nullif(v_weekly -> v_dow ->> 'open', '')::time, v_open);
    v_close := coalesce(nullif(v_weekly -> v_dow ->> 'close', '')::time, v_close);
  end if;
  if v_open is not null and v_close is not null and p_slot ~ '^[0-9]{1,2}:[0-9]{2}$' then
    if p_slot::time < v_open or p_slot::time >= v_close then
      raise exception 'slot outside opening hours';
    end if;
  end if;

  update public.payments p
     set status = 'cancelled'
    from public.bookings b
   where p.booking_id = b.id and p.kind = 'booking' and p.status = 'created'
     and b.user_id = v_uid and b.shop_id = p_shop_id
     and b.scheduled_date = p_date and b.slot_time = p_slot
     and b.status = 'pending_payment';
  update public.bookings
     set status = 'cancelled'
   where user_id = v_uid and shop_id = p_shop_id
     and scheduled_date = p_date and slot_time = p_slot
     and status = 'pending_payment';

  select count(*) into v_count
  from public.bookings
  where shop_id = p_shop_id and scheduled_date = p_date and slot_time = p_slot
    and status <> 'cancelled'
    and (status <> 'pending_payment' or created_at > now() - interval '30 minutes');
  if v_count >= coalesce(v_cap, 1) then
    raise exception 'slot full';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;

  select coalesce((select sum(price) from public.services where id = any (p_service_ids)), 0)
       + coalesce((select sum(price) from public.shop_custom_services
                    where shop_id = p_shop_id and id::text = any (p_service_ids)), 0)
    into v_subtotal;
  select count(distinct r.sid) into v_resolved from (
    select id::text as sid from public.services where id = any (p_service_ids)
    union
    select id::text from public.shop_custom_services where shop_id = p_shop_id and id::text = any (p_service_ids)
  ) r;
  if v_resolved <> (select count(distinct x) from unnest(p_service_ids) x) then
    raise exception 'unknown services';
  end if;
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  v_member := v_profile.selected_plan = 'premium'
              and coalesce(v_profile.membership_until, date '1900-01-01') >= current_date;
  if v_member then
    select coalesce(discount_percent, 0) into v_pct from public.plans where id = 'premium';
    if coalesce(v_pct, 0) > 0 then
      v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
    end if;
  end if;

  if v_code is not null then
    select * into v_coupon from public.coupons
      where code = upper(v_code)
        and (expires_at is null or expires_at >= current_date)
      for update;
    if not found then raise exception 'invalid or expired code'; end if;
    if v_coupon.members_only and not v_member then
      raise exception 'coupon requires membership';
    end if;
    if v_coupon.max_uses is not null
       and (
         (select count(*) from public.coupon_redemptions where coupon_code = v_coupon.code)
         + (select count(*) from public.bookings
              where coupon_code = v_coupon.code and status = 'pending_payment'
                and created_at > now() - interval '30 minutes')
       ) >= v_coupon.max_uses then
      raise exception 'coupon usage limit reached';
    end if;
    if v_coupon.per_user_limit is not null
       and (
         (select count(*) from public.coupon_redemptions where coupon_code = v_coupon.code and user_id = v_uid)
         + (select count(*) from public.bookings
              where coupon_code = v_coupon.code and user_id = v_uid and status = 'pending_payment'
                and created_at > now() - interval '30 minutes')
       ) >= v_coupon.per_user_limit then
      raise exception 'coupon already used';
    end if;
    if coalesce(v_coupon.amount_off, 0) > 0 then
      v_coupon_discount := v_coupon.amount_off;
    elsif coalesce(v_coupon.percent, 0) > 0 then
      v_coupon_discount := round((v_subtotal * v_coupon.percent / 100.0) / 1000) * 1000;
    end if;
    v_coupon_discount := least(v_coupon_discount, greatest(0, v_subtotal - v_discount));
  end if;

  v_total := greatest(0, v_subtotal - v_discount - v_coupon_discount);
  if v_total <= 0 then
    raise exception 'nothing to pay - use the wallet path';
  end if;

  insert into public.bookings
    (user_id, shop_id, scheduled_date, slot_time, plan_id, total,
     free_wash, earned_stamp, status, coupon_code, expected_plate)
  values
    (v_uid, p_shop_id, p_date, p_slot, v_profile.selected_plan, v_total,
     false, false, 'pending_payment',
     case when v_coupon_discount > 0 then v_coupon.code else null end,
     nullif(btrim(p_expected_plate), ''))
  returning id into v_booking;

  insert into public.booking_services (booking_id, service_id, unit_price)
  select v_booking, s.id, s.price
  from public.services s where s.id = any (p_service_ids);

  insert into public.booking_services (booking_id, custom_service_id, custom_name, unit_price)
  select v_booking, c.id, c.name, c.price
  from public.shop_custom_services c
  where c.shop_id = p_shop_id and c.id::text = any (p_service_ids);

  return jsonb_build_object('booking_id', v_booking, 'amount', v_total);
end;
$function$;
revoke execute on function public.create_pending_booking(text, date, text, text[], text, text) from public, anon;
grant execute on function public.create_pending_booking(text, date, text, text[], text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
