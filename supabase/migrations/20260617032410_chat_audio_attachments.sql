-- 0030 CHAT AUDIO ATTACHMENTS — allow voice messages by extending the message
-- attachment type to include 'audio' alongside 'image' and 'video'.
alter table public.messages drop constraint if exists messages_attachment_type_check;
alter table public.messages
  add constraint messages_attachment_type_check
  check (attachment_type in ('image', 'video', 'audio'));
