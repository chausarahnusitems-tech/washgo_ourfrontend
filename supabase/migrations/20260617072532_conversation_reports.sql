-- 0036 CONVERSATION REPORTS — either party of a customer<->owner ('shop') chat
-- can flag the conversation for the admins to review. Admins read every report;
-- the reporter can read their own. Writes go through SECURITY DEFINER RPCs only.

create table if not exists public.conversation_reports (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reported_by     uuid not null references auth.users(id) on delete cascade,
  reason          text,
  status          text not null default 'open' check (status in ('open', 'resolved')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users(id) on delete set null
);
create index if not exists conversation_reports_conv_idx on public.conversation_reports(conversation_id);
create index if not exists conversation_reports_status_idx on public.conversation_reports(status);

alter table public.conversation_reports enable row level security;

drop policy if exists "Reports readable by admin or reporter" on public.conversation_reports;
create policy "Reports readable by admin or reporter"
  on public.conversation_reports for select to authenticated
  using (public.is_admin() or reported_by = (select auth.uid()));

-- File a report, or refresh the caller's existing OPEN one (so repeat taps don't
-- stack). Only a participant of a 'shop' thread may report; admins are the
-- recipients, not reporters, and aren't participants of shop chats anyway.
create or replace function public.report_conversation(p_conv uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_kind   text;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select kind into v_kind from public.conversations where id = p_conv;
  if not found then raise exception 'conversation not found'; end if;
  if v_kind <> 'shop' then raise exception 'only shop chats can be reported'; end if;
  if not public.is_conversation_participant(p_conv) then raise exception 'not allowed'; end if;

  update public.conversation_reports
    set reason = v_reason, created_at = now()
    where conversation_id = p_conv and reported_by = v_uid and status = 'open';
  if not found then
    insert into public.conversation_reports (conversation_id, reported_by, reason)
    values (p_conv, v_uid, v_reason);
  end if;
end; $$;
revoke execute on function public.report_conversation(uuid, text) from public, anon;
grant  execute on function public.report_conversation(uuid, text) to authenticated;

-- Admin: flip a report between open and resolved.
create or replace function public.set_report_status(p_report uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_status not in ('open', 'resolved') then raise exception 'invalid status'; end if;
  update public.conversation_reports
    set status = p_status,
        resolved_at = case when p_status = 'resolved' then now() else null end,
        resolved_by = case when p_status = 'resolved' then v_uid else null end
    where id = p_report;
end; $$;
revoke execute on function public.set_report_status(uuid, text) from public, anon;
grant  execute on function public.set_report_status(uuid, text) to authenticated;
