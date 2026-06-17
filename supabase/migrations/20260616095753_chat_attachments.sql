-- 0026 CHAT ATTACHMENTS — photos and videos on messages. The file lives in the
-- public 'chat-attachments' bucket under <conversation_id>/<uid>/<file>; the
-- message row stores its public URL + media type so the client renders an <img>
-- or <video>. body stays NOT NULL; attachment-only messages send body = ''.

alter table public.messages
  add column if not exists attachment_url  text,
  add column if not exists attachment_type text
    check (attachment_type in ('image', 'video'));

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- Upload path = <conversation_id>/<uid>/<filename>: foldername()[1] = conv id,
-- [2] = uploader uid. Gate INSERT/UPDATE to participants (or admins) of that
-- conversation. No SELECT policy (public bucket serves via getPublicUrl, same
-- hardening rationale as 0010 / claim-photos). The [1]::uuid cast fails closed
-- on a malformed path, so the upload helper MUST always build <conv>/<uid>/<file>.
drop policy if exists "Participants upload chat attachments" on storage.objects;
create policy "Participants upload chat attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (
      public.is_conversation_participant(((storage.foldername(name))[1])::uuid)
      or public.is_admin()
    )
  );

drop policy if exists "Participants update chat attachments" on storage.objects;
create policy "Participants update chat attachments"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (
      public.is_conversation_participant(((storage.foldername(name))[1])::uuid)
      or public.is_admin()
    )
  );
