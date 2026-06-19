-- 0042 PROMO CODES — let customers type a coupon code at checkout that applies a
-- discount, validated and enforced server-side (never trust the client amount).
-- Reuses the existing public.coupons table (code/percent/expires_at); adds an
-- optional fixed-amount kind and records which code a booking used.

-- Fixed-amount codes (in VND) in addition to the existing percent codes. A code
-- uses amount_off when set, else percent.
alter table public.coupons add column if not exists amount_off integer
  check (amount_off is null or amount_off >= 0);

-- Audit which code (if any) priced a booking.
alter table public.bookings add column if not exists coupon_code text;

-- A couple of seeded demo codes (idempotent).
insert into public.coupons (code, description, percent, expires_at) values
  ('WASHGO10', '10% off your wash', 10, current_date + 180),
  ('CLEAN20K', '20.000₫ off your wash', 0, current_date + 180)
on conflict (code) do nothing;
update public.coupons set amount_off = 20000 where code = 'CLEAN20K';

-- create_booking gains p_coupon_code. We DROP the old 5-arg signature so there's
-- no overload ambiguity, then recreate with the coupon parameter. Body is the
-- 0019 version plus server-side coupon validation + discount.
drop function if exists public.create_booking(text, date, text, text[], boolean);

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
         coalesce(o.max_cars_per_slot, s.max_cars_per_slot)
    into v_closed, v_cap
  from public.shops s
  left join public.shop_slot_overrides o on o.shop_id = s.id and o.date = p_date
  where s.id = p_shop_id;
  if v_closed then raise exception 'shop closed on this date'; end if;

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

  if v_profile.selected_plan = 'premium'
     and coalesce(v_profile.membership_until, date '1900-01-01') >= current_date then
    select coalesce(discount_percent, 0) into v_pct from public.plans where id = 'premium';
    if coalesce(v_pct, 0) > 0 then
      v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
    end if;
  end if;

  -- Promo/referral code: re-validate and re-price server-side.
  if v_code is not null then
    select * into v_coupon from public.coupons
      where code = upper(v_code)
        and (expires_at is null or expires_at >= current_date);
    if not found then raise exception 'invalid or expired code'; end if;
    if coalesce(v_coupon.amount_off, 0) > 0 then
      v_coupon_discount := v_coupon.amount_off;
    elsif coalesce(v_coupon.percent, 0) > 0 then
      v_coupon_discount := round((v_subtotal * v_coupon.percent / 100.0) / 1000) * 1000;
    end if;
    -- Never discount below zero once membership is also applied.
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
     case when v_coupon_discount > 0 then upper(v_code) else null end)
  returning id into v_booking;

  insert into public.booking_services (booking_id, service_id, unit_price)
  select v_booking, s.id, s.price
  from public.services s where s.id = any (p_service_ids);

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
