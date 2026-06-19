-- 0021 DIRECTORY BOOKING GATES + CLAIM/ONBOARDING RPCs.
-- Directory listings must never be bookable, even via a crafted API call, so the
-- three booking-path functions now require listing_type = 'partner'. Bodies are
-- identical to 0016 (slot_availability) and 0019 (create/update_booking) except
-- for that single added predicate.
--
-- The claim/onboarding RPCs implement the long-term path for a real owner to take
-- over their directory listing (see 0020 header for the flow).

-- create_booking: only 'partner' shops can be booked.
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
  v_closed   boolean;
  v_cap      integer;
  v_count    integer;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'no services selected';
  end if;
  if not exists (
    select 1 from public.shops
    where id = p_shop_id and status = 'approved' and published and listing_type = 'partner'
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
    'stamps', v_profile.stamps, 'voucher', v_profile.voucher
  );
end;
$$;

-- update_booking: re-check the shop is still a bookable 'partner'.
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
  v_total    integer;
  v_delta    integer;
  v_funds    integer;
  v_closed   boolean;
  v_cap      integer;
  v_count    integer;
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
    select 1 from public.shops
    where id = v_booking.shop_id and status = 'approved' and published and listing_type = 'partner'
  ) then
    raise exception 'shop not available';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_booking.shop_id || p_date::text || p_slot)::bigint);

  select coalesce(o.is_closed, false),
         coalesce(o.max_cars_per_slot, s.max_cars_per_slot)
    into v_closed, v_cap
  from public.shops s
  left join public.shop_slot_overrides o on o.shop_id = s.id and o.date = p_date
  where s.id = v_booking.shop_id;
  if v_closed then raise exception 'shop closed on this date'; end if;
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
  v_total := greatest(0, v_subtotal - v_discount);

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

-- slot_availability: a directory listing has no bookable slots (returns closed).
create or replace function public.slot_availability(p_shop_id text, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed boolean;
  v_cap    integer;
  v_counts jsonb;
begin
  select coalesce(o.is_closed, false),
         coalesce(o.max_cars_per_slot, s.max_cars_per_slot)
    into v_closed, v_cap
  from public.shops s
  left join public.shop_slot_overrides o on o.shop_id = s.id and o.date = p_date
  where s.id = p_shop_id and s.status = 'approved' and s.published and s.listing_type = 'partner';
  if not found then
    return jsonb_build_object('closed', true, 'cap', 0, 'counts', '{}'::jsonb);
  end if;

  select coalesce(jsonb_object_agg(slot_time, c), '{}'::jsonb) into v_counts
  from (
    select slot_time, count(*) as c
    from public.bookings
    where shop_id = p_shop_id and scheduled_date = p_date and status <> 'cancelled'
    group by slot_time
  ) q;

  return jsonb_build_object('closed', v_closed, 'cap', coalesce(v_cap, 1), 'counts', v_counts);
end;
$$;

-- ---- Claim / onboarding ----------------------------------------------------

-- A signed-in user registers intent to claim a directory listing. Records the
-- claimer (first-come; admin resolves conflicts) and is idempotent for that user.
-- The real verification happens at admin approval.
create or replace function public.claim_listing(p_shop_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not exists (
    select 1 from public.shops where id = p_shop_id and listing_type = 'directory'
  ) then
    raise exception 'not a claimable directory listing';
  end if;
  update public.shops
  set claimed_by = v_uid
  where id = p_shop_id and (claimed_by is null or claimed_by = v_uid);
end;
$$;
revoke execute on function public.claim_listing(text) from public, anon;
grant execute on function public.claim_listing(text) to authenticated;

-- Admin converts a claimed directory listing into a real partner shop owned by
-- the claimer (or an explicit user): assigns ownership, flips listing_type, and
-- unpublishes it so the new owner configures hours/services/capacity before
-- releasing it publicly. Also promotes that user to the owner role.
create or replace function public.approve_listing_claim(p_shop_id text, p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select coalesce(p_user_id, claimed_by) into v_owner
  from public.shops where id = p_shop_id and listing_type = 'directory';
  if v_owner is null then
    raise exception 'no claimant for this listing';
  end if;
  update public.shops
  set owner_id = v_owner,
      listing_type = 'partner',
      published = false,
      claimed_by = null
  where id = p_shop_id and listing_type = 'directory';
  update public.profiles
  set role = 'owner', owner_status = 'approved'
  where id = v_owner and role <> 'admin';
end;
$$;
revoke execute on function public.approve_listing_claim(text, uuid) from public, anon;
grant execute on function public.approve_listing_claim(text, uuid) to authenticated;
