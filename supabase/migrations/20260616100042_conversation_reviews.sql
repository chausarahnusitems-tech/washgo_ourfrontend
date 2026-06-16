-- 0028 CONVERSATION REVIEWS — after a chat is closed, the non-admin participant
-- can rate the support/resolution experience (1..5 + optional comment). Works for
-- both 'support' and 'shop' threads. Independent of the booking-gated shop
-- reviews table (which is shop-scoped and requires a completed booking).

create table if not exists public.conversation_reviews (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  rating          integer not null check (rating between 1 and 5),
  comment         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (conversation_id, user_id)        -- one review per reviewer per thread
);

create index if not exists conversation_reviews_conv_idx
  on public.conversation_reviews(conversation_id);

drop trigger if exists conversation_reviews_set_updated_at on public.conversation_reviews;
create trigger conversation_reviews_set_updated_at
  before update on public.conversation_reviews
  for each row execute function public.set_updated_at();

alter table public.conversation_reviews enable row level security;

-- READ: the reviewer, conversation participants, and admins.
drop policy if exists "Conversation reviews readable" on public.conversation_reviews;
create policy "Conversation reviews readable"
  on public.conversation_reviews for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_conversation_participant(conversation_id)
    or public.is_admin()
  );

-- INSERT: only a non-admin participant, only for self, only on a CLOSED thread.
-- (Admins are the support side and shouldn't rate their own handling.)
drop policy if exists "Participants review closed threads" on public.conversation_reviews;
create policy "Participants review closed threads"
  on public.conversation_reviews for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not public.is_admin()
    and public.is_conversation_participant(conversation_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.status = 'closed'
    )
  );

-- UPDATE own review (re-rate). Still gated to a non-admin owner of the row.
drop policy if exists "Users update their conversation review" on public.conversation_reviews;
create policy "Users update their conversation review"
  on public.conversation_reviews for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and not public.is_admin());
