-- 0063 ADD-ON SUGGESTIONS IN BOOKING CHAT
-- A shop owner can suggest an add-on (name, price, explanation, photos) inside a
-- booking's chat thread; the customer can accept or reject it. Record-only —
-- accepting does NOT change the booking total or charge the wallet (the owner
-- settles any extra at completion). Accept/reject state lives here (not on the
-- immutable messages table) and is flipped by SECURITY DEFINER RPCs.

create table if not exists public.booking_addon_suggestions (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations(id) on delete cascade,
  booking_id        uuid references public.bookings(id) on delete cascade,
  suggested_by      uuid references auth.users(id) on delete set null,
  custom_service_id uuid references public.shop_custom_services(id) on delete set null,
  name              text not null,
  price             integer not null check (price >= 0),   -- VND
  note              text,
  photo_urls        text[] not null default '{}',
  status            text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at        timestamptz not null default now(),
  responded_at      timestamptz
);
create index if not exists booking_addon_suggestions_conv_idx on public.booking_addon_suggestions(conversation_id);

alter table public.booking_addon_suggestions enable row level security;

-- Read: thread participants (customer + owner), the shop owner, or an admin.
drop policy if exists "Addon suggestions readable by participants" on public.booking_addon_suggestions;
create policy "Addon suggestions readable by participants"
  on public.booking_addon_suggestions for select to authenticated
  using (
    public.is_conversation_participant(conversation_id)
    or public.is_shop_owner_of_conversation(conversation_id)
    or public.is_admin()
  );
-- No insert/update/delete policy on purpose: all writes go through the RPCs below.

-- Anchor column on messages: a message carrying this renders as a suggestion card.
alter table public.messages
  add column if not exists addon_suggestion_id uuid references public.booking_addon_suggestions(id) on delete set null;

-- suggest_addon: OWNER-only. Records the suggestion + posts an anchor chat message.
create or replace function public.suggest_addon(
  p_conv uuid,
  p_name text,
  p_price integer,
  p_note text default null,
  p_photos text[] default '{}',
  p_custom_service_id uuid default null
)
returns public.booking_addon_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_book uuid;
  v_row  public.booking_addon_suggestions%rowtype;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'add-on name required'; end if;
  if not (public.is_shop_owner_of_conversation(p_conv) or public.is_admin()) then
    raise exception 'not allowed';
  end if;
  select booking_id into v_book from public.conversations where id = p_conv;
  if v_book is null then raise exception 'not a booking chat'; end if;

  insert into public.booking_addon_suggestions
    (conversation_id, booking_id, suggested_by, custom_service_id, name, price, note, photo_urls)
  values
    (p_conv, v_book, v_uid, p_custom_service_id, btrim(p_name),
     greatest(0, coalesce(p_price, 0)), nullif(btrim(p_note), ''), coalesce(p_photos, '{}'))
  returning * into v_row;

  -- body is NOT NULL and drives the conversation-list preview; give it a real string.
  insert into public.messages (conversation_id, sender_id, body, addon_suggestion_id)
  values (p_conv, v_uid, 'Suggested add-on: ' || btrim(p_name), v_row.id);

  return v_row;
end;
$$;
revoke execute on function public.suggest_addon(uuid, text, integer, text, text[], uuid) from public, anon;
grant  execute on function public.suggest_addon(uuid, text, integer, text, text[], uuid) to authenticated;

-- respond_addon: the CUSTOMER (thread creator) or an admin accepts/rejects a pending suggestion.
create or replace function public.respond_addon(p_suggestion uuid, p_accept boolean)
returns public.booking_addon_suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_conv       uuid;
  v_created_by uuid;
  v_row        public.booking_addon_suggestions%rowtype;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select bas.conversation_id, c.created_by
    into v_conv, v_created_by
  from public.booking_addon_suggestions bas
  join public.conversations c on c.id = bas.conversation_id
  where bas.id = p_suggestion
  for update of bas;
  if not found then raise exception 'suggestion not found'; end if;
  if v_created_by <> v_uid and not public.is_admin() then raise exception 'not allowed'; end if;

  update public.booking_addon_suggestions
     set status = case when p_accept then 'accepted' else 'rejected' end,
         responded_at = now()
   where id = p_suggestion and status = 'pending'
  returning * into v_row;
  if not found then raise exception 'already responded'; end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (v_conv, v_uid,
          case when p_accept then 'Accepted add-on: ' || v_row.name
               else 'Declined add-on: ' || v_row.name end);

  return v_row;
end;
$$;
revoke execute on function public.respond_addon(uuid, boolean) from public, anon;
grant  execute on function public.respond_addon(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
