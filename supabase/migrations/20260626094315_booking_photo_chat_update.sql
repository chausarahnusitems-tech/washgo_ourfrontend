-- 0060 AUTO CHAT UPDATE ON ARRIVAL/COMPLETION — when the owner uploads the
-- arrival (intake) photo or the completion (plate-scan) photo, automatically
-- post a message to the customer in that booking's chat thread, with the photo
-- attached. The per-booking conversation already exists (open_conversation_for_
-- booking creates it on insert) and the unread trigger notifies the customer.

-- Helper: post an automated update from the shop owner (auth.uid()) into the
-- booking's conversation, with the photo attached. Localised to the customer's
-- language. No-ops when there's no photo or no thread.
create or replace function public.post_booking_photo_update(
  p_booking_id uuid,
  p_photo_url  text,
  p_phase      text  -- 'arrival' | 'completion'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid      uuid := auth.uid();
  v_conv     uuid;
  v_customer uuid;
  v_lang     text;
  v_body     text;
begin
  if p_photo_url is null or btrim(p_photo_url) = '' then return; end if;

  select id into v_conv from public.conversations where booking_id = p_booking_id;
  if v_conv is null then return; end if;

  select user_id into v_customer from public.bookings where id = p_booking_id;
  select coalesce(lang, 'en') into v_lang from public.profiles where id = v_customer;

  if p_phase = 'arrival' then
    v_body := case when v_lang = 'vi'
      then 'Xe của bạn đã đến tiệm và đang bắt đầu được rửa. 🚗'
      else 'Your car has arrived at the shop — the wash is starting now. 🚗' end;
  else
    v_body := case when v_lang = 'vi'
      then 'Xe của bạn đã rửa xong! ✨ Cảm ơn bạn đã sử dụng dịch vụ.'
      else 'Your car wash is complete! ✨ Thanks for choosing us.' end;
  end if;

  insert into public.messages (conversation_id, sender_id, body, attachment_url, attachment_type)
  values (v_conv, v_uid, v_body, p_photo_url, 'image');
end;
$function$;

revoke execute on function public.post_booking_photo_update(uuid, text, text) from public, anon, authenticated;

-- Recreate owner_mark_arrived to post the arrival update after marking in_progress.
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

  perform public.post_booking_photo_update(p_booking_id, coalesce(p_photo_url, v_row.intake_photo_url), 'arrival');

  return v_row;
end;
$function$;

-- Recreate owner_complete_booking to post the completion update after completing.
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

  perform public.post_booking_photo_update(p_booking_id, coalesce(p_photo_url, v_row.completion_photo_url), 'completion');

  return v_row;
end;
$function$;
