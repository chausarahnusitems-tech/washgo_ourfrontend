-- 0033 CONVERSATION ARCHIVE — a reversible soft-hide for closed threads, so the
-- chat list can tuck them into an "Archived" view instead of deleting. Shared
-- state on the conversation (like status). Same rights as delete: admin or creator.
alter table public.conversations
  add column if not exists archived_at timestamptz;  -- null = not archived

create or replace function public.set_conversation_archived(p_conv uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_created_by uuid;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select created_by into v_created_by from public.conversations where id = p_conv;
  if not found then raise exception 'conversation not found'; end if;
  if not (public.is_admin() or v_created_by = v_uid) then
    raise exception 'not allowed';
  end if;
  update public.conversations
    set archived_at = case when p_archived then now() else null end
    where id = p_conv;
end;
$$;
revoke execute on function public.set_conversation_archived(uuid, boolean) from public, anon;
grant  execute on function public.set_conversation_archived(uuid, boolean) to authenticated;
