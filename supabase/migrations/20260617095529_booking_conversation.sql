-- 0038 BOOKING CONVERSATION — tie a chat to a specific booking session. Whenever
-- a booking is created, open a customer<->owner ('shop') thread for that booking,
-- seed its participants, and post a context message. Fires for both the RPC path
-- (create_booking) and any direct table insert (the bookings RLS allows it).

alter table public.conversations
  add column if not exists booking_id uuid references public.bookings(id) on delete cascade;

-- At most one conversation per booking. NULLs allowed → ordinary (non-booking)
-- shop threads from "Message shop" are unaffected.
create unique index if not exists conversations_booking_id_key
  on public.conversations(booking_id);

create or replace function public.open_conversation_for_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_conv  uuid;
  v_owner uuid;
begin
  insert into public.conversations (kind, shop_id, booking_id, created_by)
  values ('shop', new.shop_id, new.id, new.user_id)
  on conflict (booking_id) do nothing
  returning id into v_conv;
  if v_conv is null then return new; end if;  -- already exists

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conv, new.user_id)
  on conflict do nothing;

  select owner_id into v_owner from public.shops where id = new.shop_id;
  if v_owner is not null and v_owner <> new.user_id then
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conv, v_owner)
    on conflict do nothing;
  end if;

  -- Seed a context message (also populates last_message_at/preview via trigger).
  insert into public.messages (conversation_id, sender_id, body)
  values (
    v_conv,
    new.user_id,
    'Booking confirmed for ' || to_char(new.scheduled_date, 'FMMon FMDD, YYYY') || ' at ' || new.slot_time || '.'
  );

  return new;
end; $$;
-- Trigger function fires with the table owner's rights; not meant as an RPC.
revoke execute on function public.open_conversation_for_booking() from public, anon, authenticated;

drop trigger if exists bookings_open_conversation on public.bookings;
create trigger bookings_open_conversation
  after insert on public.bookings
  for each row execute function public.open_conversation_for_booking();
