-- 0053 CUSTOM BOOKABLE SERVICES — let owners' per-shop custom services
-- (public.shop_custom_services) be booked like catalogue services, and have them
-- show up in owner analytics. Also adds an admin plate-mismatch view RPC.
--
-- Until now booking_services.service_id referenced public.services ONLY, with a
-- composite PK (booking_id, service_id) — so a custom service (uuid id) could not
-- be a booking line. We give booking_services a surrogate id, allow a line to be
-- EITHER a catalogue service OR a custom one, and snapshot the custom service's
-- name so history/analytics survive the owner later deleting it.

-- ---------------------------------------------------------------------------
-- 1. booking_services: allow custom-service lines.
alter table public.booking_services drop constraint if exists booking_services_pkey;

alter table public.booking_services
  add column if not exists id uuid not null default gen_random_uuid();
alter table public.booking_services add primary key (id);

alter table public.booking_services alter column service_id drop not null;

alter table public.booking_services
  add column if not exists custom_service_id uuid references public.shop_custom_services (id) on delete set null,
  add column if not exists custom_name text;

-- Exactly one of: a catalogue service_id, or a custom service (identified by its
-- snapshotted name; custom_service_id may go null if the owner deletes it later).
alter table public.booking_services drop constraint if exists booking_services_one_kind;
alter table public.booking_services
  add constraint booking_services_one_kind check (num_nonnulls(service_id, custom_name) = 1);

-- No duplicate lines per booking (replaces the old composite PK's uniqueness).
create unique index if not exists booking_services_catalog_uniq
  on public.booking_services (booking_id, service_id) where service_id is not null;
create unique index if not exists booking_services_custom_uniq
  on public.booking_services (booking_id, custom_service_id) where custom_service_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Rewrite the three booking RPCs. Faithful copies of the live definitions,
-- changed ONLY in three spots: subtotal (catalogue + this-shop custom), the
-- id-resolution guard, and the booking_services inserts. Custom ids ride inside
-- the existing p_service_ids text[] (uuids as text) — no signature change.

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

  -- Subtotal across catalogue services + this shop's own custom services.
  select coalesce((select sum(price) from public.services where id = any (p_service_ids)), 0)
       + coalesce((select sum(price) from public.shop_custom_services
                    where shop_id = p_shop_id and id::text = any (p_service_ids)), 0)
    into v_subtotal;
  -- Every passed id must resolve to a catalogue service or one of THIS shop's
  -- custom services (rejects unknown / other-shop ids).
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
    v_free := true;
    v_total := 0;
  end if;

  if not v_free and v_profile.funds < v_total then
    raise exception 'insufficient funds';
  end if;

  insert into public.bookings
    (user_id, shop_id, scheduled_date, slot_time, plan_id, total,
     free_wash, earned_stamp, status, coupon_code)
  values
    (v_uid, p_shop_id, p_date, p_slot, v_profile.selected_plan, v_total,
     v_free, not v_free, 'upcoming',
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
    update public.profiles
    set voucher = false, pending_voucher = false, stamps = 0
    where id = v_uid;
  else
    if v_total > 0 then
      insert into public.wallet_transactions (user_id, booking_id, amount, kind)
      values (v_uid, v_booking, -v_total, 'charge');
    end if;
    v_stamp := true;
    update public.profiles
    set funds = funds - v_total,
        stamps = least(5, stamps + 1),
        voucher = (least(5, stamps + 1) >= 5)
    where id = v_uid;
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
     false, true, 'pending_payment',
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

create or replace function public.update_booking(
  p_booking_id uuid, p_date date, p_slot text, p_service_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid      uuid := auth.uid();
  v_booking  public.bookings%rowtype;
  v_profile  public.profiles%rowtype;
  v_subtotal integer;
  v_resolved integer;
  v_pct      integer := 0;
  v_discount integer := 0;
  v_coupon_discount integer := 0;
  v_coupon   public.coupons%rowtype;
  v_total    integer;
  v_delta    integer;
  v_funds    integer;
  v_closed   boolean;
  v_cap      integer;
  v_count    integer;
  v_weekly   jsonb;
  v_open     time;
  v_close    time;
  v_dow      text := (extract(dow from p_date)::int)::text;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'no services selected';
  end if;

  select * into v_booking from public.bookings
  where id = p_booking_id and user_id = v_uid
  for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status <> 'upcoming' then
    raise exception 'only upcoming bookings can be edited';
  end if;

  if not exists (
    select 1 from public.shops where id = v_booking.shop_id and status = 'approved' and published
  ) then
    raise exception 'shop not available';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_booking.shop_id || p_date::text || p_slot)::bigint);

  select coalesce(o.is_closed, false),
         coalesce(o.max_cars_per_slot, s.max_cars_per_slot),
         s.weekly_hours, s.open_time, s.close_time
    into v_closed, v_cap, v_weekly, v_open, v_close
  from public.shops s
  left join public.shop_slot_overrides o on o.shop_id = s.id and o.date = p_date
  where s.id = v_booking.shop_id;
  if v_closed or public.is_weekly_closed(v_weekly, p_date) then
    raise exception 'shop closed on this date';
  end if;

  if v_weekly is not null and (v_weekly -> v_dow) is not null then
    v_open  := coalesce(nullif(v_weekly -> v_dow ->> 'open',  '')::time, v_open);
    v_close := coalesce(nullif(v_weekly -> v_dow ->> 'close', '')::time, v_close);
  end if;
  if v_open is not null and v_close is not null and p_slot ~ '^[0-9]{1,2}:[0-9]{2}$' then
    if p_slot::time < v_open or p_slot::time >= v_close then
      raise exception 'slot outside opening hours';
    end if;
  end if;

  select count(*) into v_count
  from public.bookings
  where shop_id = v_booking.shop_id and scheduled_date = p_date and slot_time = p_slot
    and status <> 'cancelled' and id <> p_booking_id
    and (status <> 'pending_payment' or created_at > now() - interval '30 minutes');
  if v_count >= coalesce(v_cap, 1) then
    raise exception 'slot full';
  end if;

  select coalesce((select sum(price) from public.services where id = any (p_service_ids)), 0)
       + coalesce((select sum(price) from public.shop_custom_services
                    where shop_id = v_booking.shop_id and id::text = any (p_service_ids)), 0)
    into v_subtotal;
  select count(distinct r.sid) into v_resolved from (
    select id::text as sid from public.services where id = any (p_service_ids)
    union
    select id::text from public.shop_custom_services where shop_id = v_booking.shop_id and id::text = any (p_service_ids)
  ) r;
  if v_resolved <> (select count(distinct x) from unnest(p_service_ids) x) then
    raise exception 'unknown services';
  end if;
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  -- Reprice under the plan the booking was originally made on, not the caller's
  -- current plan, so an unrelated membership change can't alter the edit price.
  if v_booking.plan_id is not null then
    select coalesce(discount_percent, 0) into v_pct from public.plans where id = v_booking.plan_id;
    if coalesce(v_pct, 0) > 0 then
      v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
    end if;
  end if;

  if v_booking.coupon_code is not null then
    select * into v_coupon from public.coupons
      where code = upper(v_booking.coupon_code)
        and (expires_at is null or expires_at >= current_date);
    if found then
      if coalesce(v_coupon.amount_off, 0) > 0 then
        v_coupon_discount := v_coupon.amount_off;
      elsif coalesce(v_coupon.percent, 0) > 0 then
        v_coupon_discount := round((v_subtotal * v_coupon.percent / 100.0) / 1000) * 1000;
      end if;
      v_coupon_discount := least(v_coupon_discount, greatest(0, v_subtotal - v_discount));
    end if;
  end if;

  v_total := greatest(0, v_subtotal - v_discount - v_coupon_discount);

  if v_booking.free_wash then v_total := 0; end if;

  v_delta := v_booking.total - v_total;
  v_funds := v_profile.funds;
  if v_delta < 0 and v_funds < -v_delta then
    raise exception 'insufficient funds';
  end if;

  update public.bookings
  set scheduled_date = p_date, slot_time = p_slot, total = v_total
  where id = p_booking_id;

  delete from public.booking_services where booking_id = p_booking_id;
  insert into public.booking_services (booking_id, service_id, unit_price)
  select p_booking_id, s.id, s.price
  from public.services s where s.id = any (p_service_ids);
  insert into public.booking_services (booking_id, custom_service_id, custom_name, unit_price)
  select p_booking_id, c.id, c.name, c.price
  from public.shop_custom_services c
  where c.shop_id = v_booking.shop_id and c.id::text = any (p_service_ids);

  if v_delta <> 0 then
    insert into public.wallet_transactions (user_id, booking_id, amount, kind)
    values (v_uid, p_booking_id, v_delta, case when v_delta > 0 then 'refund' else 'charge' end);
    update public.profiles set funds = funds + v_delta where id = v_uid
    returning funds into v_funds;
  end if;

  return jsonb_build_object('booking_id', p_booking_id, 'total', v_total,
                            'delta', v_delta, 'funds', v_funds);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Admin plate-mismatch view. Admins have no SELECT on bookings, so expose
-- completed bookings whose scanned plate did NOT match the registered one via a
-- SECURITY DEFINER RPC that checks is_admin() internally.
create or replace function public.admin_plate_mismatches()
returns table (
  booking_id           uuid,
  shop_id              text,
  shop_name            text,
  scheduled_date       date,
  slot_time            text,
  expected_plate       text,
  scanned_plate        text,
  completed_at         timestamptz,
  completion_photo_url text,
  customer_name        text,
  customer_phone       text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    select b.id, b.shop_id, s.name, b.scheduled_date, b.slot_time,
           b.expected_plate, b.scanned_plate, b.completed_at, b.completion_photo_url,
           p.full_name, p.phone
    from public.bookings b
    join public.shops s on s.id = b.shop_id
    left join public.profiles p on p.id = b.user_id
    where b.status = 'completed'
      and b.scanned_plate is not null
      and b.plate_verified = false
    order by b.completed_at desc nulls last;
end;
$function$;

revoke execute on function public.admin_plate_mismatches() from public, anon;
grant  execute on function public.admin_plate_mismatches() to authenticated;
