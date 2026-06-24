-- 0018 CHAT — participant-based conversations so any pair of roles can talk:
-- customer<->owner (kind='shop') and user<->admins (kind='support'). Admins are
-- the implicit support side and can read/reply to every thread via is_admin().

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('shop', 'support')),
  shop_id    text references public.shops(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references auth.users(id) on delete set null,
  body            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_conversation_participant(p_conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conv and user_id = (select auth.uid())
  );
$$;
revoke execute on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

drop policy if exists "Conversations readable by participants" on public.conversations;
create policy "Conversations readable by participants"
  on public.conversations for select to authenticated
  using (public.is_conversation_participant(id) or public.is_admin());

drop policy if exists "Participants readable" on public.conversation_participants;
create policy "Participants readable"
  on public.conversation_participants for select to authenticated
  using (public.is_conversation_participant(conversation_id) or public.is_admin());

drop policy if exists "Messages readable by participants" on public.messages;
create policy "Messages readable by participants"
  on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id) or public.is_admin());

drop policy if exists "Messages insertable by participants" on public.messages;
create policy "Messages insertable by participants"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (public.is_conversation_participant(conversation_id) or public.is_admin())
  );

-- Find-or-create a thread and seed its participants. 'shop' = caller (customer)
-- + the shop's owner; 'support' = just the caller (admins join on read).
create or replace function public.open_conversation(p_kind text, p_shop_id text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_conv  uuid;
  v_owner uuid;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_kind not in ('shop', 'support') then raise exception 'invalid kind'; end if;

  if p_kind = 'shop' then
    if p_shop_id is null then raise exception 'shop required'; end if;
    select owner_id into v_owner from public.shops where id = p_shop_id;
    select id into v_conv from public.conversations
      where kind = 'shop' and shop_id = p_shop_id and created_by = v_uid
      limit 1;
    if v_conv is null then
      insert into public.conversations (kind, shop_id, created_by)
      values ('shop', p_shop_id, v_uid) returning id into v_conv;
      insert into public.conversation_participants (conversation_id, user_id)
      values (v_conv, v_uid) on conflict do nothing;
      if v_owner is not null then
        insert into public.conversation_participants (conversation_id, user_id)
        values (v_conv, v_owner) on conflict do nothing;
      end if;
    end if;
  else
    select id into v_conv from public.conversations
      where kind = 'support' and created_by = v_uid
      limit 1;
    if v_conv is null then
      insert into public.conversations (kind, created_by)
      values ('support', v_uid) returning id into v_conv;
      insert into public.conversation_participants (conversation_id, user_id)
      values (v_conv, v_uid) on conflict do nothing;
    end if;
  end if;

  return v_conv;
end;
$$;
revoke execute on function public.open_conversation(text, text) from public, anon;
grant execute on function public.open_conversation(text, text) to authenticated;
