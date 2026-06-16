-- 0025 CHAT CLOSE — let the requester, a shop-owner participant, or an admin
-- mark a conversation 'closed'. Closed threads are read-only: the composer is
-- disabled client-side AND the messages-insert policy below rejects new rows.

alter table public.conversations
  add column if not exists status    text not null default 'open'
    check (status in ('open', 'closed')),
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users(id) on delete set null;

-- Close (idempotent). Authorization: admin, the conversation creator, or any
-- participant (covers the shop owner on a 'shop' thread). SECURITY DEFINER so it
-- can update conversations without granting a broad UPDATE on the table.
create or replace function public.close_conversation(p_conv uuid)
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

  if not (
    public.is_admin()
    or v_created_by = v_uid
    or public.is_conversation_participant(p_conv)
  ) then
    raise exception 'not allowed';
  end if;

  update public.conversations
    set status = 'closed', closed_at = now(), closed_by = v_uid
    where id = p_conv and status <> 'closed';   -- idempotent: no-op if already closed
end;
$$;

revoke execute on function public.close_conversation(uuid) from public, anon;
grant  execute on function public.close_conversation(uuid) to authenticated;

-- Block new messages on a closed thread (defense in depth alongside the client).
-- Re-creates the existing insert policy from 0019 with the open-status guard.
-- The subquery reads conversations by PK and never re-enters the messages policy,
-- so there is no RLS recursion.
drop policy if exists "Messages insertable by participants" on public.messages;
create policy "Messages insertable by participants"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (public.is_conversation_participant(conversation_id) or public.is_admin())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.status = 'open'
    )
  );
