-- 0050 SECURITY HARDENING (from the code review)
--  #1/#11 stop clients writing reward/loyalty/plan columns directly
--  #2     bookings table is SELECT-only; all writes go through the RPCs
--  #3     coupon abuse controls (members-only, usage caps, redemption ledger)
--  #4     enforce the weekly-hours window server-side + tolerant closed parse
--  #12    update_booking re-applies the booking's coupon
--  advisors: set search_path on the new helpers; lock down the media buckets

-- ---------------------------------------------------------------------------
-- #1 / #11 — voucher/stamps/pending_voucher/selected_plan move ONLY through the
-- SECURITY DEFINER RPCs (create_booking/cancel_booking/complete_profile_reward/
-- start_membership), which bypass column grants. updateProfile only ever writes
-- name/phone/car_model/avatar/vehicle/lang, so revoking these is safe.
revoke update (stamps, voucher, pending_voucher, selected_plan) on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- #2 — bookings are created/edited/cancelled ONLY via create_booking /
-- update_booking / cancel_booking (all SECURITY DEFINER). Drop the table-level
-- write policy so a direct INSERT can't mint a 0-priced, uncharged booking.
drop policy if exists "Users manage their own bookings" on public.bookings;
create policy "Users can view their own bookings"
  on public.bookings for select to authenticated
  using ((select auth.uid()) = user_id);
-- DELETE is still allowed for a user's own rows (history cleanup in deleteBooking);
-- it mints no money and refunds go through cancel_booking. INSERT/UPDATE are NOT
-- granted, forcing pricing/charging through create_booking / update_booking.
create policy "Users can delete their own bookings"
  on public.bookings for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- #3 — coupon abuse controls.
alter table public.coupons add column if not exists members_only boolean not null default false;
alter table public.coupons add column if not exists max_uses integer;             -- null = unlimited globally
alter table public.coupons add column if not exists per_user_limit integer default 1; -- null = unlimited per user
update public.coupons set members_only = true where code in ('SHINE10', 'SEASON15');

create table if not exists public.coupon_redemptions (
  id          uuid primary key default gen_random_uuid(),
  coupon_code text not null references public.coupons(code) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  booking_id  uuid references public.bookings(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists coupon_redemptions_code_idx on public.coupon_redemptions(coupon_code);
create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions(user_id);
alter table public.coupon_redemptions enable row level security;
drop policy if exists "Users read own redemptions" on public.coupon_redemptions;
create policy "Users read own redemptions" on public.coupon_redemptions for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- advisors / #4 — harden the helper functions (search_path + tolerant boolean).
create or replace function public.profile_is_complete(p public.profiles)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(btrim(p.full_name), '') <> ''
     and coalesce(btrim(p.phone), '') <> ''
     and coalesce(btrim(coalesce(p.car_model, p.vehicle->>'model')), '') <> ''
     and coalesce(btrim(p.vehicle->>'plate'), '') <> '';
$$;

-- Tolerant of any jsonb 'closed' value (avoids a 22P02 cast error crashing the
-- booking RPCs if an owner writes a non-boolean).
create or replace function public.is_weekly_closed(p_weekly jsonb, p_date date)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_weekly is null then false
    else coalesce(
      lower(p_weekly -> (extract(dow from p_date)::int::text) ->> 'closed') in ('true', 't', '1', 'yes', 'on'),
      false)
  end;
$$;

-- ---------------------------------------------------------------------------
-- create_booking — adds: coupon members-only + usage caps + redemption ledger,
-- and server-side enforcement of the per-weekday opening-hours window.
create or replace function public.create_booking(
  p_shop_id     text,
  p_date        date,
  p_slot        text,
  p_service_ids text[],
  p_use_voucher boolean default false,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_subtotal integer;
  v_discount integer := 0;
  v_coupon_discount integer := 0;
  v_coupon   public.coupons%rowtype;
  v_code     text := nullif(btrim(coalesce(p_coupon_code, '')), '');
  v_total    integer;
  v_free     boolean := false;
  v_stamp    boolean := false;
  v_booking  uuid;
  v_pct      integer;
  v_closed   boolean;
  v_cap      integer;
  v_count    integer;
  v_weekly   jsonb;
  v_open     time;
  v_close    time;
  v_dow      text := (extract(dow from p_date)::int)::text;
  v_member   boolean;
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

  -- Resolve the effective opening window for this weekday and reject out-of-hours
  -- slots (only when hours are configured and the slot is a HH:MM value).
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
  where shop_id = p_shop_id and scheduled_date = p_date and slot_time = p_slot
    and status <> 'cancelled';
  if v_count >= coalesce(v_cap, 1) then
    raise exception 'slot full';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;

  select coalesce(sum(price), 0) into v_subtotal
  from public.services where id = any (p_service_ids);
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
        and (expires_at is null or expires_at >= current_date);
    if not found then raise exception 'invalid or expired code'; end if;
    if v_coupon.members_only and not v_member then
      raise exception 'coupon requires membership';
    end if;
    if v_coupon.max_uses is not null
       and (select count(*) from public.coupon_redemptions where coupon_code = v_coupon.code) >= v_coupon.max_uses then
      raise exception 'coupon usage limit reached';
    end if;
    if v_coupon.per_user_limit is not null
       and (select count(*) from public.coupon_redemptions where coupon_code = v_coupon.code and user_id = v_uid) >= v_coupon.per_user_limit then
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
$$;

revoke execute on function public.create_booking(text, date, text, text[], boolean, text) from public, anon;
grant  execute on function public.create_booking(text, date, text, text[], boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- update_booking — re-applies the booking's coupon (#12) and enforces the
-- weekly-hours window, so an edit can't silently drop the discount or move the
-- booking outside opening hours.
create or replace function public.update_booking(
  p_booking_id  uuid,
  p_date        date,
  p_slot        text,
  p_service_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_booking  public.bookings%rowtype;
  v_profile  public.profiles%rowtype;
  v_subtotal integer;
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
    and status <> 'cancelled' and id <> p_booking_id;
  if v_count >= coalesce(v_cap, 1) then
    raise exception 'slot full';
  end if;

  select coalesce(sum(price), 0) into v_subtotal
  from public.services where id = any (p_service_ids);
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.selected_plan = 'premium'
     and coalesce(v_profile.membership_until, date '1900-01-01') >= current_date then
    select coalesce(discount_percent, 0) into v_pct from public.plans where id = 'premium';
    if coalesce(v_pct, 0) > 0 then
      v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
    end if;
  end if;

  -- Re-apply the booking's original coupon so an edit keeps the same discount.
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

  if v_delta <> 0 then
    insert into public.wallet_transactions (user_id, booking_id, amount, kind)
    values (v_uid, p_booking_id, v_delta, case when v_delta > 0 then 'refund' else 'charge' end);
    update public.profiles set funds = funds + v_delta where id = v_uid
    returning funds into v_funds;
  end if;

  return jsonb_build_object('booking_id', p_booking_id, 'total', v_total,
                            'delta', v_delta, 'funds', v_funds);
end;
$$;

-- ---------------------------------------------------------------------------
-- advisors — lock down the media buckets: no broad listing on shop-videos, and
-- server-enforced size/type limits (so the client-only caps can't be bypassed).
drop policy if exists "Shop videos are publicly readable" on storage.objects;

update storage.buckets
  set file_size_limit = 52428800,  -- 50MB
      allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']
  where id = 'shop-videos';

update storage.buckets
  set file_size_limit = 26214400,  -- 25MB
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
  where id = 'shop-photos';
