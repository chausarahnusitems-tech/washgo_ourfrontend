-- CHAT UNREAD TRIGGER HARDEN
-- Historical repair entry from the remote migration ledger. Keep the message
-- summary trigger definition idempotent so local resets reproduce production.

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
end;
$$;

revoke execute on function public.touch_conversation_on_message() from public, anon, authenticated;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();
