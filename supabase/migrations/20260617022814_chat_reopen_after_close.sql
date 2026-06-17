-- 0029 CHAT REOPEN AFTER CLOSE — find-or-create must ignore CLOSED threads so a
-- user (or admin) who closed a support/shop conversation can start a fresh one.
-- Previously open_conversation/open_support_thread matched ANY existing thread by
-- (kind, created_by), so after closing they kept returning the closed (read-only)
-- thread and "Start chat" appeared to do nothing. Scope the lookup to open
-- threads and prefer the most recent.

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

  if p_kind = 'shop' then
    if p_shop_id is null then raise exception 'shop required'; end if;
    select owner_id into v_owner from public.shops where id = p_shop_id;
    select id into v_conv from public.conversations
      where kind = 'shop' and shop_id = p_shop_id and created_by = v_uid
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

-- Admin counterpart: same "ignore closed" rule so an admin re-messaging a user
-- after a closed thread opens a fresh one rather than reviving the closed one.
create or replace function public.open_support_thread(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv uuid;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_user_id is null then raise exception 'user required'; end if;

  select id into v_conv from public.conversations
    where kind = 'support' and created_by = p_user_id
      and status <> 'closed'
    order by created_at desc
    limit 1;
  if v_conv is null then
    insert into public.conversations (kind, created_by)
    values ('support', p_user_id) returning id into v_conv;
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conv, p_user_id) on conflict do nothing;
  end if;

  return v_conv;
end;
$$;
revoke execute on function public.open_support_thread(uuid) from public, anon;
grant execute on function public.open_support_thread(uuid) to authenticated;
