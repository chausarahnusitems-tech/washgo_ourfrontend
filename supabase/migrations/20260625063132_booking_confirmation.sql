-- 0050 BOOKING CONFIRMATION (arrival/completion + plate scan) — the shop owner
-- photographs a car when it arrives and again when the wash is finished. The
-- completion scan reads the licence plate (client-side OCR) and we record it +
-- whether it matches the plate registered on the booking.
--
-- Three new realities this migration creates:
--   1. A real 'arrived' state and a real 'completed' write. Until now nothing
--      ever wrote status='completed' — it was derived from elapsed time in the
--      client (see src/lib/booking.js getBookingStatus). The owner flow is the
--      first true writer, which also finally activates the verified-review RLS
--      (reviews require a booking with status='completed').
--   2. A plate to match a scan against. The plate lived only on
--      profiles.vehicle->>'plate' (per user). We snapshot it onto each booking at
--      creation time (trigger) so completion-time matching is a simple compare.
--   3. A place to put the photos. Owners can only SELECT bookings (no UPDATE),
--      so every write below goes through a SECURITY DEFINER RPC scoped to shop
--      ownership, and the photos live in a new owner-writable storage bucket.

-- ---------------------------------------------------------------------------
-- 1. New booking columns + the 'arrived' lifecycle state.
alter table public.bookings
  add column if not exists arrived_at           timestamptz,
  add column if not exists completed_at         timestamptz,
  add column if not exists intake_photo_url     text,
  add column if not exists completion_photo_url text,
  add column if not exists expected_plate       text,  -- plate registered at booking time
  add column if not exists scanned_plate        text,  -- plate read at completion
  add column if not exists plate_verified       boolean not null default false;

-- Extend the status CHECK to allow 'arrived' (mirrors the payos_billing edit).
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending_payment', 'upcoming', 'arrived', 'completed', 'cancelled'));

-- ---------------------------------------------------------------------------
-- 2. Snapshot the customer's registered plate onto every new booking. The plate
-- lives in profiles.vehicle (jsonb); copying it at insert time gives the
-- completion scan something stable to match against even if the customer later
-- edits their profile. Runs before insert so it covers create_booking AND
-- create_pending_booking without recreating those (large) RPCs.
create or replace function public.set_booking_expected_plate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.expected_plate is null then
    select nullif(btrim(p.vehicle->>'plate'), '')
    into new.expected_plate
    from public.profiles p
    where p.id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_set_expected_plate on public.bookings;
create trigger bookings_set_expected_plate
  before insert on public.bookings
  for each row execute function public.set_booking_expected_plate();

-- Backfill existing bookings from the booker's current profile plate.
update public.bookings b
set expected_plate = nullif(btrim(p.vehicle->>'plate'), '')
from public.profiles p
where p.id = b.user_id and b.expected_plate is null;

-- ---------------------------------------------------------------------------
-- 3. Owner write RPCs. Owners have SELECT-only RLS on bookings, so these
-- SECURITY DEFINER functions are the ONLY way an owner mutates a booking. Each
-- verifies the caller owns the booking's shop (or is an admin), locks the row,
-- and guards the allowed status transition.

-- Mark a booking as arrived (car checked in) + store the intake photo.
create or replace function public.owner_mark_arrived(
  p_booking_id uuid,
  p_photo_url  text default null,
  p_plate      text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'not signed in'; end if;

  select b.* into v_row
  from public.bookings b
  join public.shops s on s.id = b.shop_id
  where b.id = p_booking_id
    and (s.owner_id = v_uid or public.is_admin())
  for update of b;

  if not found then raise exception 'booking not found or not allowed'; end if;
  if v_row.status <> 'upcoming' then
    raise exception 'booking must be upcoming to mark arrived (current: %)', v_row.status;
  end if;

  update public.bookings set
    status           = 'arrived',
    arrived_at       = now(),
    intake_photo_url = coalesce(p_photo_url, intake_photo_url),
    scanned_plate    = coalesce(nullif(btrim(p_plate), ''), scanned_plate)
  where id = p_booking_id
  returning * into v_row;

  return v_row;
end;
$$;

-- Complete a booking + store the completion photo and the scanned plate. Sets
-- plate_verified when the (normalised) scanned plate equals the expected one.
create or replace function public.owner_complete_booking(
  p_booking_id uuid,
  p_photo_url  text default null,
  p_plate      text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
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
  if v_row.status not in ('upcoming', 'arrived') then
    raise exception 'booking cannot be completed (current: %)', v_row.status;
  end if;

  -- Normalise to lowercase alphanumerics so "51G-248.19" == "51g24819" (kept in
  -- sync with normalizePlate() in src/lib/plate.js).
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

  return v_row;
end;
$$;

revoke execute on function public.owner_mark_arrived(uuid, text, text)     from public, anon;
grant  execute on function public.owner_mark_arrived(uuid, text, text)     to authenticated;
revoke execute on function public.owner_complete_booking(uuid, text, text) from public, anon;
grant  execute on function public.owner_complete_booking(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Surface the booking's customer (name/phone/plate/car) to the shop owner.
-- profiles RLS is self-only, so reuse the get_conversation_customer pattern.
create or replace function public.get_booking_customer(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
begin
  if v_uid is null then raise exception 'not signed in'; end if;

  select p.full_name,
         p.phone,
         nullif(btrim(p.vehicle->>'plate'), '') as plate,
         p.car_model
  into v_row
  from public.bookings b
  join public.shops s    on s.id = b.shop_id
  join public.profiles p on p.id = b.user_id
  where b.id = p_booking_id
    and (s.owner_id = v_uid or public.is_admin());

  if not found then return null; end if;

  return jsonb_build_object(
    'full_name', v_row.full_name,
    'phone',     v_row.phone,
    'plate',     v_row.plate,
    'car_model', v_row.car_model
  );
end;
$$;

revoke execute on function public.get_booking_customer(uuid) from public, anon;
grant  execute on function public.get_booking_customer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Public storage bucket for arrival/completion photos. Owners write under
-- '<shopId>/<bookingId>/...', so the owner-by-shop RLS check (first path
-- segment = shop id) is identical to shop-photos/shop-videos. Public reads are
-- served via getPublicUrl over unguessable (uuid) paths — consistent with the
-- rest of the app, which has no signed-URL precedent.
insert into storage.buckets (id, name, public)
values ('booking-photos', 'booking-photos', true)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit   = 26214400,  -- 25 MB
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
      'image/heic', 'image/heif'  -- some phone cameras emit HEIC
    ]
where id = 'booking-photos';

drop policy if exists "Booking photos are publicly readable" on storage.objects;
create policy "Booking photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'booking-photos');

drop policy if exists "Owners can upload booking photos" on storage.objects;
create policy "Owners can upload booking photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'booking-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can update booking photos" on storage.objects;
create policy "Owners can update booking photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'booking-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can delete booking photos" on storage.objects;
create policy "Owners can delete booking photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'booking-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );
