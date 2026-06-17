-- 0037 CHAT UNREAD TRACKING — per-user read marks + a denormalized last-message
-- summary so the conversation list can highlight threads with new messages and
-- show a preview without loading every thread's messages.

-- 1) Denormalized last-message summary on the conversation, kept fresh by a
--    trigger on message insert (and backfilled below).
alter table public.conversations
  add column if not exists last_message_at      timestamptz,
  add column if not exists last_message_preview text;

create or replace function public.touch_conversation_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
    set last_message_at = new.created_at,
        last_message_preview = left(
          coalesce(
            nullif(btrim(new.body), ''),
            case new.attachment_type
              when 'image' then '[photo]'
              when 'video' then '[video]'
              when 'audio' then '[voice message]'
              else '[attachment]'
            end
          ),
          160
        )
  where id = new.conversation_id
    and (last_message_at is null or new.created_at >= last_message_at);
  return new;
end; $$;
-- Trigger functions fire with the table owner's rights regardless of caller
-- EXECUTE, so don't expose this as an RPC.
revoke execute on function public.touch_conversation_on_message() from public, anon, authenticated;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- Backfill from the latest message of each existing conversation.
update public.conversations c
set last_message_at = m.created_at,
    last_message_preview = left(
      coalesce(
        nullif(btrim(m.body), ''),
        case m.attachment_type
          when 'image' then '[photo]'
          when 'video' then '[video]'
          when 'audio' then '[voice message]'
          else '[attachment]'
        end
      ),
      160
    )
from (
  select distinct on (conversation_id) conversation_id, created_at, body, attachment_type
  from public.messages
  order by conversation_id, created_at desc
) m
where m.conversation_id = c.id;

-- 2) Per-user read marks. RLS scopes reads to the owner; writes go through the
--    SECURITY DEFINER RPC below (no direct insert/update policy).
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_reads enable row level security;

drop policy if exists "Reads readable by owner" on public.conversation_reads;
create policy "Reads readable by owner"
  on public.conversation_reads for select to authenticated
  using (user_id = (select auth.uid()));

-- Mark the caller's read position in a thread (participant or admin).
create or replace function public.mark_conversation_read(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not (public.is_conversation_participant(p_conv) or public.is_admin()) then
    raise exception 'not allowed';
  end if;
  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (p_conv, v_uid, now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end; $$;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant  execute on function public.mark_conversation_read(uuid) to authenticated;
