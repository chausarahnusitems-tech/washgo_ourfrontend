-- 0061 LOYALTY STAMP ON COMPLETION — the free-wash counter previously ticked up
-- when a booking was CREATED (wallet: create_booking; card: settle_booking_
-- payment), so a customer earned a stamp just for booking, even if the wash
-- never happened. Move stamp-earning to when the wash is actually COMPLETED
-- (owner_complete_booking). Bookings now start with earned_stamp=false; a stamp
-- is granted at completion for a paid wash that hasn't already earned one.
--
-- cancel_booking / expire_missed_bookings need no change: they only reverse a
-- stamp when earned_stamp is true, which is now only the case for completed (and
-- thus non-cancellable) bookings, or legacy bookings that earned at creation.

-- ---------------------------------------------------------------------------
-- create_booking (wallet): no stamp at creation; earned_stamp=false.
create or replace function public.create_booking(
  p_shop_id text, p_date date, p_slot text, p_service_ids text[],
  p_use_voucher boolean default false, p_coupon_code text default null::text
)
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
     free_wash, earned_stamp, status, coupon_code)
  values
    (v_uid, p_shop_id, p_date, p_slot, v_profile.selected_plan, v_total,
     v_free, false, 'upcoming',
     case when v_coupon_discount > 0 then v_coupon.code else null end)
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
    -- The loyalty stamp is awarded when the wash is COMPLETED
    -- (owner_complete_booking), not at booking time. Just charge here.
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

-- ---------------------------------------------------------------------------
-- create_pending_booking (card): earned_stamp=false (no stamp until completion).
create or replace function public.create_pending_booking(
  p_shop_id text, p_date date, p_slot text, p_service_ids text[], p_coupon_code text default null::text
)
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
     free_wash, earned_stamp, status, coupon_code)
  values
    (v_uid, p_shop_id, p_date, p_slot, v_profile.selected_plan, v_total,
     false, false, 'pending_payment',
     case when v_coupon_discount > 0 then v_coupon.code else null end)
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

-- ---------------------------------------------------------------------------
-- settle_booking_payment (card webhook): confirm the booking, but DON'T award
-- the stamp here — that now happens at completion.
create or replace function public.settle_booking_payment(p_booking_id uuid, p_payment_id uuid, p_received integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_pay public.payments%rowtype;
  v_profile public.profiles%rowtype;
  v_has_booking boolean;
begin
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  if v_pay.status = 'paid' then
    return jsonb_build_object('payment_id', p_payment_id, 'already', true);
  end if;
  if coalesce(p_received, 0) <= 0 then raise exception 'invalid received amount'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  v_has_booking := found;

  if v_has_booking and v_booking.status = 'pending_payment' and p_received >= v_booking.total then
    update public.bookings set status = 'upcoming' where id = p_booking_id;

    if v_booking.coupon_code is not null then
      insert into public.coupon_redemptions (coupon_code, user_id, booking_id)
      values (v_booking.coupon_code, v_booking.user_id, p_booking_id);
    end if;

    update public.payments set status = 'paid' where id = p_payment_id;

    select * into v_profile from public.profiles where id = v_booking.user_id;
    return jsonb_build_object('booking_id', p_booking_id, 'delivered', true,
                             'stamps', v_profile.stamps, 'voucher', v_profile.voucher);
  end if;

  insert into public.wallet_transactions (user_id, booking_id, amount, kind, note)
  values (v_pay.user_id, p_booking_id, p_received, 'refund',
          'PayOS booking payment credited to wallet (booking not completed)');
  update public.profiles set funds = funds + p_received where id = v_pay.user_id;
  if v_has_booking and v_booking.status = 'pending_payment' then
    update public.bookings set status = 'cancelled' where id = p_booking_id;
  end if;
  update public.payments set status = 'paid' where id = p_payment_id;
  return jsonb_build_object('booking_id', p_booking_id, 'credited_to_wallet', p_received);
end;
$function$;

-- ---------------------------------------------------------------------------
-- owner_complete_booking: award the loyalty stamp now that the wash is done
-- (paid washes only, and only if one wasn't already earned at creation under the
-- old logic). Keeps the auto chat-update from migration 0060.
create or replace function public.owner_complete_booking(
  p_booking_id uuid,
  p_photo_url  text default null,
  p_plate      text default null
)
returns public.bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.bookings%rowtype;
  v_exp text;
  v_scn text;
begin
  if v_uid is null then raise exception 'not signed in'; end if;

  select b.* into v_row
  from public.bookings b
  join public.shops s on s.id = b.shop_id
  where b.id = p_booking_id
    and (s.owner_id = v_uid or public.is_admin())
  for update of b;

  if not found then raise exception 'booking not found or not allowed'; end if;
  if v_row.status not in ('upcoming', 'in_progress') then
    raise exception 'booking cannot be completed (current: %)', v_row.status;
  end if;

  v_exp := regexp_replace(lower(coalesce(v_row.expected_plate, '')), '[^a-z0-9]', '', 'g');
  v_scn := regexp_replace(lower(coalesce(p_plate, '')), '[^a-z0-9]', '', 'g');

  update public.bookings set
    status               = 'completed',
    completed_at         = now(),
    completion_photo_url = coalesce(p_photo_url, completion_photo_url),
    scanned_plate        = coalesce(nullif(btrim(p_plate), ''), scanned_plate),
    plate_verified       = (v_exp <> '' and v_exp = v_scn)
  where id = p_booking_id
  returning * into v_row;

  -- Award the loyalty stamp on completion for a paid wash that hasn't already
  -- earned one (legacy bookings that earned at creation keep their single stamp).
  if not v_row.free_wash and not v_row.earned_stamp then
    update public.profiles
    set stamps = least(5, stamps + 1),
        voucher = (least(5, stamps + 1) >= 5)
    where id = v_row.user_id;
    insert into public.reward_ledger (user_id, booking_id, type, stamp_delta)
    values (v_row.user_id, p_booking_id, 'earn', 1);
    update public.bookings set earned_stamp = true where id = p_booking_id;
    v_row.earned_stamp := true;
  end if;

  perform public.post_booking_photo_update(p_booking_id, coalesce(p_photo_url, v_row.completion_photo_url), 'completion');

  return v_row;
end;
$function$;
