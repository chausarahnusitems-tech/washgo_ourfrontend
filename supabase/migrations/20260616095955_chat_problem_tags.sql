-- 0027 CHAT PROBLEM TAGS — predefined triage tags chosen when a support thread
-- is opened, so admins can sort faster. Stored as a slug array; the label set is
-- defined client-side (copy.js / PROBLEM_TAGS). text[] models multi-select
-- natively and leaves room for later GIN/@> triage filtering without a join table.

alter table public.conversations
  add column if not exists problem_tags text[] not null default '{}';

-- open_conversation gains an optional p_tags so tag-setting is atomic with
-- find-or-create and stays inside the SECURITY DEFINER boundary (callers have no
-- direct UPDATE on conversations). CREATE OR REPLACE can't change a signature, so
-- drop the 2-arg version first; api.js always passes p_tags going forward.
drop function if exists public.open_conversation(text, text);

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
