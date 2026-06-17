-- 0039 BOOKING CHAT ACCESS FIXES
-- (1) The generic "Message shop" find-or-create must NOT reuse a per-booking
--     thread, so scope its lookup to booking_id IS NULL. The per-booking trigger
--     is unaffected (it inserts an explicit booking_id with its own ON CONFLICT).
-- (2) A shop's CURRENT owner can read/reply to that shop's conversations even if
--     they weren't a participant at booking time (owner set/changed after the
--     fact), so the owner's thread list, the /owner/bookings "Open chat" link,
--     replies and read-marks all stay correct.

create or replace function public.open_conversation(
  p_kind text,
  p_shop_id text default null,
  p_tags text[] default '{}'
)
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
  if p_kind = 'support' and public.is_admin() then
    raise exception 'admins do not open support threads';
  end if;

  if p_kind = 'shop' then
    if p_shop_id is null then raise exception 'shop required'; end if;
    select owner_id into v_owner from public.shops where id = p_shop_id;
    select id into v_conv from public.conversations
      where kind = 'shop' and shop_id = p_shop_id and created_by = v_uid
        and booking_id is null            -- keep the generic thread distinct from per-booking ones
        and status <> 'closed'
      order by created_at desc
      limit 1;
    if v_conv is null then
      insert into public.conversations (kind, shop_id, created_by, problem_tags)
      values ('shop', p_shop_id, v_uid, coalesce(p_tags, '{}')) returning id into v_conv;
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
        and status <> 'closed'
      order by created_at desc
      limit 1;
    if v_conv is null then
      insert into public.conversations (kind, created_by, problem_tags)
      values ('support', v_uid, coalesce(p_tags, '{}')) returning id into v_conv;
      insert into public.conversation_participants (conversation_id, user_id)
      values (v_conv, v_uid) on conflict do nothing;
    end if;
  end if;

  return v_conv;
end;
$$;
revoke execute on function public.open_conversation(text, text, text[]) from public, anon;
grant  execute on function public.open_conversation(text, text, text[]) to authenticated;

-- True when the caller is the current owner of the shop a conversation belongs to.
-- SECURITY DEFINER so its internal reads bypass RLS (no recursion on conversations).
create or replace function public.is_shop_owner_of_conversation(p_conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    join public.shops s on s.id = c.shop_id
    where c.id = p_conv and s.owner_id = (select auth.uid())
  );
$$;
revoke execute on function public.is_shop_owner_of_conversation(uuid) from public, anon;
grant  execute on function public.is_shop_owner_of_conversation(uuid) to authenticated;

-- Extend conversation/message access to the shop's current owner.
drop policy if exists "Conversations readable by participants" on public.conversations;
create policy "Conversations readable by participants"
  on public.conversations for select to authenticated
  using (
    public.is_conversation_participant(id)
    or public.is_admin()
    or public.is_shop_owner_of_conversation(id)
  );

drop policy if exists "Messages readable by participants" on public.messages;
create policy "Messages readable by participants"
  on public.messages for select to authenticated
  using (
    public.is_conversation_participant(conversation_id)
    or public.is_admin()
    or public.is_shop_owner_of_conversation(conversation_id)
  );

drop policy if exists "Messages insertable by participants" on public.messages;
create policy "Messages insertable by participants"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      public.is_conversation_participant(conversation_id)
      or public.is_admin()
      or public.is_shop_owner_of_conversation(conversation_id)
    )
  );

-- Let the shop owner mark their shop's threads read too.
create or replace function public.mark_conversation_read(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not (
    public.is_conversation_participant(p_conv)
    or public.is_admin()
    or public.is_shop_owner_of_conversation(p_conv)
  ) then
    raise exception 'not allowed';
  end if;
  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (p_conv, v_uid, now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end; $$;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant  execute on function public.mark_conversation_read(uuid) to authenticated;
