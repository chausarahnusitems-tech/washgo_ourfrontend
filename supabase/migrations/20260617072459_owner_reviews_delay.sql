-- 0035 OWNER REVIEW DELAY — anti-retaliation: a shop chat's OWNER (a participant
-- who isn't the reviewer) can only read a conversation review 5 days after it was
-- left. The reviewer always sees their own review immediately; admins always see
-- every review. Only the SELECT policy changes (insert/update untouched).

drop policy if exists "Conversation reviews readable" on public.conversation_reviews;
create policy "Conversation reviews readable"
  on public.conversation_reviews for select to authenticated
  using (
    user_id = (select auth.uid())                         -- the reviewer: always
    or public.is_admin()                                  -- admins: always
    or (
      public.is_conversation_participant(conversation_id) -- e.g. the shop owner
      and created_at <= now() - interval '5 days'         -- only after a cool-off
    )
  );
