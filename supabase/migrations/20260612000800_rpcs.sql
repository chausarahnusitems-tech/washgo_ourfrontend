-- 0008 ATOMIC RPCs — the only write path for money and loyalty. Each function
-- is SECURITY DEFINER (the ledger has no client write policies), validates
-- auth.uid() itself, and locks the caller's profile row so concurrent calls
-- can't double-spend or double-stamp. Mirrors the frontend rules in
-- src/lib/AppContext.jsx (confirmBooking / cancelBooking / topUpFunds).

-- Top up the wallet. Payment processing is out of scope (the app's top-up is
-- explicitly fake today) — when a PSP is integrated, its webhook calls this
-- with the captured amount.
create or replace function public.top_up(p_amount integer, p_note text default null)
returns integer -- new balance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_funds integer;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception 'invalid amount';
  end if;

  select funds into v_funds from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;

  insert into public.wallet_transactions (user_id, amount, kind, note)
  values (v_uid, p_amount, 'topup', p_note);

  update public.profiles set funds = funds + p_amount where id = v_uid
  returning funds into v_funds;

  return v_funds;
end;
$$;

-- Create a booking: price from the catalog (server-side, never trusted from
-- the client), premium discount from plans.discount_percent, charge the
-- wallet (or burn the free-wash voucher), award the loyalty stamp.
create or replace function public.create_booking(
  p_shop_id     text,
  p_date        date,
  p_slot        text,
  p_service_ids text[],
  p_use_voucher boolean default false
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
  v_total    integer;
  v_free     boolean := false;
  v_stamp    boolean := false;
  v_booking  uuid;
  v_pct      integer;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'no services selected';
  end if;
  if not exists (
    select 1 from public.shops where id = p_shop_id and status = 'approved'
  ) then
    raise exception 'shop not available';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;

  select coalesce(sum(price), 0) into v_subtotal
  from public.services where id = any (p_service_ids);
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  -- Premium-style discount, rounded to the nearest 1.000₫ (same as the UI).
  select coalesce(discount_percent, 0) into v_pct
  from public.plans where id = v_profile.selected_plan;
  if coalesce(v_pct, 0) > 0 then
    v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
  end if;
  v_total := greatest(0, v_subtotal - v_discount);

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
     free_wash, earned_stamp, status)
  values
    (v_uid, p_shop_id, p_date, p_slot, v_profile.selected_plan, v_total,
     v_free, not v_free, 'upcoming')
  returning id into v_booking;

  insert into public.booking_services (booking_id, service_id, unit_price)
  select v_booking, s.id, s.price
  from public.services s where s.id = any (p_service_ids);

  if v_free then
    -- Burn the voucher; the loyalty card restarts.
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
    'booking_id', v_booking,
    'total', v_total,
    'free_wash', v_free,
    'earned_stamp', v_stamp,
    'funds', v_profile.funds,
    'stamps', v_profile.stamps,
    'voucher', v_profile.voucher
  );
end;
$$;

-- Cancel an upcoming booking: refund what was paid, reverse the stamp (and a
-- voucher unlocked by it), or restore the voucher if this was the free wash.
create or replace function public.cancel_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not signed in'; end if;

  select * into v_booking from public.bookings
  where id = p_booking_id and user_id = v_uid
  for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status <> 'upcoming' then
    raise exception 'only upcoming bookings can be cancelled';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;

  update public.bookings set status = 'cancelled' where id = p_booking_id;

  if v_booking.total > 0 then
    insert into public.wallet_transactions (user_id, booking_id, amount, kind)
    values (v_uid, p_booking_id, v_booking.total, 'refund');
  end if;

  update public.profiles
  set funds = funds + v_booking.total,
      -- A cancelled free wash restores the voucher (card stays restarted);
      -- a cancelled stamp-earning booking takes its stamp (and any voucher
      -- that stamp unlocked) back.
      voucher = case
        when v_booking.free_wash then true
        when v_booking.earned_stamp then (greatest(0, stamps - 1) >= 5)
        else voucher end,
      stamps = case
        when v_booking.earned_stamp then greatest(0, stamps - 1)
        else stamps end
  where id = v_uid;

  select * into v_profile from public.profiles where id = v_uid;
  return jsonb_build_object(
    'refunded', v_booking.total,
    'funds', v_profile.funds,
    'stamps', v_profile.stamps,
    'voucher', v_profile.voucher
  );
end;
$$;

-- Map/discovery: approved shops within a radius, nearest first. SECURITY
-- INVOKER on purpose — the shops RLS (approved-only for customers) applies.
create or replace function public.nearby_shops(
  p_lat float8, p_lng float8, p_radius_km float8 default 5.0
)
returns table (
  id text, name text, district text, address text, rating numeric,
  reviews_count integer, starting_price integer, wait_minutes integer,
  hours text, is_open boolean, promo boolean, lat float8, lng float8,
  image_url text, image_position text, distance_km float8
)
language sql
stable
set search_path = public, extensions
as $$
  select s.id, s.name, s.district, s.address, s.rating, s.reviews_count,
         s.starting_price, s.wait_minutes, s.hours, s.is_open, s.promo,
         s.lat, s.lng, s.image_url, s.image_position,
         earth_distance(ll_to_earth(s.lat, s.lng), ll_to_earth(p_lat, p_lng)) / 1000.0
           as distance_km
  from public.shops s
  where s.lat is not null and s.lng is not null
    and earth_distance(ll_to_earth(s.lat, s.lng), ll_to_earth(p_lat, p_lng))
        <= p_radius_km * 1000.0
  order by distance_km;
$$;

-- Money-moving functions: signed-in users only. nearby_shops is fine for anon
-- (the app browses signed-out) — RLS still hides non-approved shops.
revoke execute on function public.top_up(integer, text) from public, anon;
revoke execute on function public.create_booking(text, date, text, text[], boolean) from public, anon;
revoke execute on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.top_up(integer, text) to authenticated;
grant execute on function public.create_booking(text, date, text, text[], boolean) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.nearby_shops(float8, float8, float8) to anon, authenticated;
