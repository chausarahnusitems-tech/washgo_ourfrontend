-- 0031 DELETE CONVERSATION — hard-delete a thread (cascades messages, participants
-- and reviews via ON DELETE CASCADE). Allowed for an admin or the thread creator.
-- SECURITY DEFINER since there is no DELETE policy on conversations.
create or replace function public.delete_conversation(p_conv uuid)
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
  if not found then return; end if;  -- already gone: no-op
  if not (public.is_admin() or v_created_by = v_uid) then
    raise exception 'not allowed';
  end if;
  delete from public.conversations where id = p_conv;  -- cascades to children
end;
$$;
revoke execute on function public.delete_conversation(uuid) from public, anon;
grant  execute on function public.delete_conversation(uuid) to authenticated;
