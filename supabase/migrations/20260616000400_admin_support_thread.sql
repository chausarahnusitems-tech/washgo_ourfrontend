-- 0024 ADMIN SUPPORT THREAD — let an admin open (find-or-create) the support
-- conversation belonging to a specific user, so admins can message applicants to
-- arrange a physical verification visit. The thread is created as that user's
-- support thread (created_by = the user); admins read/reply via is_admin().
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
