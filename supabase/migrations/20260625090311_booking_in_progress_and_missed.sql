-- 0055 IN-PROGRESS + AUTO-MISS (core)
--   * Rename the post-arrival state 'arrived' -> 'in_progress' (the owner taking
--     the arrival photo starts the wash). Add a terminal 'missed' state.
--   * parse_slot_time(): parse the free-text slot label to a time (mirrors
--     parseSlotTime in src/lib/booking.js).
--   * expire_missed_bookings(): mark an 'upcoming' booking 'missed' + refund the
--     customer once its slot is >1h past with no arrival photo (status still
--     'upcoming' = the owner never checked the car in). Scheduling is in the next
--     migration (pg_cron).

-- Migrate any existing 'arrived' rows, then widen the allowed status set.
update public.bookings set status = 'in_progress' where status = 'arrived';

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending_payment', 'upcoming', 'in_progress', 'completed', 'cancelled', 'missed'));

-- The arrival photo now moves the booking to 'in_progress'.
create or replace function public.owner_mark_arrived(
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
    raise exception 'booking must be upcoming to start (current: %)', v_row.status;
  end if;

  update public.bookings set
    status           = 'in_progress',
    arrived_at       = now(),
    intake_photo_url = coalesce(p_photo_url, intake_photo_url),
    scanned_plate    = coalesce(nullif(btrim(p_plate), ''), scanned_plate)
  where id = p_booking_id
  returning * into v_row;

  return v_row;
end;
$function$;

-- Completion accepts a booking that is upcoming or in_progress.
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

  return v_row;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Parse a stored slot label ("12.00PM" legacy / "14:30" structured) to a time.
-- Mirrors parseSlotTime in src/lib/booking.js. NULL when unparseable.
create or replace function public.parse_slot_time(p_label text)
returns time
language plpgsql
immutable
as $function$
declare
  m   text[];
  h   int;
  mi  int;
  mer text;
begin
  if p_label is null then return null; end if;
  m := regexp_match(btrim(p_label), '^(\d{1,2})[:.](\d{2})\s*([AaPp][Mm])?$');
  if m is null then return null; end if;
  h := m[1]::int;
  mi := m[2]::int;
  mer := upper(coalesce(m[3], ''));
  if mer = 'AM' then
    if h = 12 then h := 0; end if;
  elsif mer = 'PM' then
    if h <> 12 then h := h + 12; end if;
  end if;
  if h > 23 or mi > 59 then return null; end if;
  return make_time(h, mi, 0);
end;
$function$;

revoke execute on function public.parse_slot_time(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auto-miss + refund. A booking still 'upcoming' more than 1h after its slot
-- (the owner never took the arrival photo => the customer never showed) is
-- marked 'missed' and fully refunded to the wallet, mirroring cancel_booking's
-- refund + loyalty restoration. Booking times are local wall-clock; the app is
-- Vietnam-based, so we interpret them in Asia/Ho_Chi_Minh.
create or replace function public.expire_missed_bookings()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer := 0;
  r public.bookings%rowtype;
begin
  for r in
    select b.* from public.bookings b
    where b.status = 'upcoming'
      and public.parse_slot_time(b.slot_time) is not null
      and ((b.scheduled_date + public.parse_slot_time(b.slot_time)) at time zone 'Asia/Ho_Chi_Minh')
            + interval '1 hour' < now()
    for update skip locked
  loop
    update public.bookings set status = 'missed' where id = r.id;

    if r.total > 0 then
      insert into public.wallet_transactions (user_id, booking_id, amount, kind, note)
      values (r.user_id, r.id, r.total, 'refund', 'No-show auto-refund (missed booking)');
    end if;

    update public.profiles
    set funds = funds + r.total,
        voucher = case
          when r.free_wash then true
          when r.earned_stamp then (greatest(0, stamps - 1) >= 5)
          else voucher end,
        stamps = case
          when r.earned_stamp then greatest(0, stamps - 1)
          else stamps end
    where id = r.user_id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke execute on function public.expire_missed_bookings() from public, anon, authenticated;
grant  execute on function public.expire_missed_bookings() to service_role;
