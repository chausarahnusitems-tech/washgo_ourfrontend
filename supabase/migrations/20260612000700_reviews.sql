-- 0007 REVIEWS — makes shops.rating / reviews_count real, system-derived
-- numbers instead of seeded strings. Owners cannot write either column (no
-- column grant), so the only path to a score is genuine customer reviews.

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  shop_id    text not null references public.shops (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  rating     integer not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One review per user per shop; editing updates it.
  unique (user_id, shop_id)
);

create index if not exists reviews_shop_idx on public.reviews (shop_id);

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;

drop policy if exists "Reviews are publicly readable" on public.reviews;
create policy "Reviews are publicly readable"
  on public.reviews for select
  using (true);

-- Verified reviews only: you must have a completed booking at the shop.
drop policy if exists "Users review shops they visited" on public.reviews;
create policy "Users review shops they visited"
  on public.reviews for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.bookings b
      where b.user_id = (select auth.uid())
        and b.shop_id = reviews.shop_id
        and b.status = 'completed'
    )
  );

drop policy if exists "Users manage their own reviews" on public.reviews;
create policy "Users manage their own reviews"
  on public.reviews for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own reviews" on public.reviews;
create policy "Users delete their own reviews"
  on public.reviews for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Recompute the shop's aggregate on every review change. SECURITY DEFINER:
-- the customer issuing the DML has no UPDATE right on shops (by design), so
-- the trigger must carry its own authority.
create or replace function public.recompute_shop_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id text := coalesce(new.shop_id, old.shop_id);
begin
  update public.shops s
  set rating = coalesce((
        select round(avg(r.rating)::numeric, 1)
        from public.reviews r where r.shop_id = v_shop_id
      ), 0),
      reviews_count = (
        select count(*) from public.reviews r where r.shop_id = v_shop_id
      )
  where s.id = v_shop_id;
  return null;
end;
$$;

drop trigger if exists reviews_recompute_rating on public.reviews;
create trigger reviews_recompute_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recompute_shop_rating();
