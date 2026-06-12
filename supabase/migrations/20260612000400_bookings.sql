-- 0004 BOOKINGS + FAVORITES — the user-owned core. Bookings mirror the shape
-- the frontend already uses (status lifecycle, free_wash / earned_stamp flags
-- that drive correct refunds and stamp reversal on cancel).

create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  shop_id        text not null references public.shops (id),
  scheduled_date date not null,
  -- Slot label exactly as the UI shows it ("12.00PM"); upgrading to a real
  -- timestamptz slot system is a later, deliberate migration.
  slot_time      text not null,
  plan_id        text references public.plans (id),
  total          integer not null check (total >= 0), -- VND actually charged
  free_wash      boolean not null default false,      -- paid with the loyalty voucher
  earned_stamp   boolean not null default false,      -- did this booking award a stamp?
  status         text not null default 'upcoming'
                   check (status in ('upcoming', 'completed', 'cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Snapshot of what was ordered at the price paid, so later catalog price
-- changes never rewrite booking history.
create table if not exists public.booking_services (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  service_id text not null references public.services (id),
  unit_price integer not null check (unit_price >= 0),
  primary key (booking_id, service_id)
);

-- The Heart toggle, currently localStorage-only in the app.
create table if not exists public.favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  shop_id    text not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

create index if not exists bookings_user_idx on public.bookings (user_id, status);
create index if not exists bookings_shop_date_idx on public.bookings (shop_id, scheduled_date);

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;
alter table public.booking_services enable row level security;
alter table public.favorites enable row level security;

-- Customers: full control over their own bookings. (Money/stamp movements are
-- meant to go through the RPCs; direct INSERT/UPDATE remains allowed at the
-- table level so the wiring transition is gradual — but wallet/ledger writes
-- are RPC-only, so a direct insert can never mint funds.)
drop policy if exists "Users manage their own bookings" on public.bookings;
create policy "Users manage their own bookings"
  on public.bookings for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Owners can see (not edit) bookings made at their shops — feeds the owner
-- dashboard's schedule view later.
drop policy if exists "Owners can view bookings at their shops" on public.bookings;
create policy "Owners can view bookings at their shops"
  on public.bookings for select
  to authenticated
  using (
    exists (
      select 1 from public.shops s
      where s.id = bookings.shop_id and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Users manage their own booking services" on public.booking_services;
create policy "Users manage their own booking services"
  on public.booking_services for all
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_services.booking_id and b.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_services.booking_id and b.user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can view booking services at their shops" on public.booking_services;
create policy "Owners can view booking services at their shops"
  on public.booking_services for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      join public.shops s on s.id = b.shop_id
      where b.id = booking_services.booking_id and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Users manage their own favorites" on public.favorites;
create policy "Users manage their own favorites"
  on public.favorites for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
