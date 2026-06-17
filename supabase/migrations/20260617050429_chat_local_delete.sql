-- 0034 LOCAL CHAT DELETE — make "Delete" a per-user hide for customers/owners
-- (remove from MY list; the thread, messages and review are preserved for the
-- other side and for records). A true purge stays admin-only and is blocked when
-- a review exists, so feedback/audit data can't be erased by a delete.

create table if not exists public.conversation_hidden (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  hidden_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_hidden enable row level security;

drop policy if exists "Hidden conversations readable by owner" on public.conversation_hidden;
create policy "Hidden conversations readable by owner"
  on public.conversation_hidden for select to authenticated
  using (user_id = (select auth.uid()));

-- Hide a conversation from the caller's own list. Any participant (or admin) may
-- hide; it never affects anyone else's view.
create or replace function public.hide_conversation(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not (public.is_conversation_participant(p_conv) or public.is_admin()) then
    raise exception 'not allowed';
  end if;
  insert into public.conversation_hidden (conversation_id, user_id)
  values (p_conv, v_uid) on conflict do nothing;
end; $$;
revoke execute on function public.hide_conversation(uuid) from public, anon;
grant  execute on function public.hide_conversation(uuid) to authenticated;

-- Hard purge ("delete for everyone") is now admin-only and refuses to erase a
-- conversation that has a review (protects the reviews/audit trail).
create or replace function public.delete_conversation(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if exists (select 1 from public.conversation_reviews where conversation_id = p_conv) then
    raise exception 'cannot delete a reviewed conversation';
  end if;
  delete from public.conversations where id = p_conv;
end; $$;
revoke execute on function public.delete_conversation(uuid) from public, anon;
grant  execute on function public.delete_conversation(uuid) to authenticated;
