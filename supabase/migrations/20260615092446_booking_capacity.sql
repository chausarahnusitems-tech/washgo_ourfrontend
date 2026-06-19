-- ---------------------------------------------------------------------------
-- Folded from 20260612000000_baseline.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0000 BASELINE â€” captures what was previously applied by hand via the SQL
-- editor (docs/supabase-auth.sql) so the repo becomes the source of truth.
-- Everything is idempotent: replaying against the live DB (which already has
-- profiles + trigger + avatars bucket) is a no-op apart from policy refreshes.

-- 1. Profiles, keyed 1:1 to Supabase's managed auth.users.
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  full_name     text,
  avatar_url    text,
  tokens        integer not null default 100,
  stamps        integer not null default 0,
  voucher       boolean not null default false,
  selected_plan text    not null default 'premium',
  vehicle       jsonb   not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists car_model text;

-- 2. Row Level Security: a user can only see / change their own row.
-- (Inserts happen via the handle_new_user trigger, not from clients.)
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by their owner" on public.profiles;
create policy "Profiles are viewable by their owner"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 3. Auto-create a profile when a new auth user signs up. Pulls name/avatar
--    from the Google identity payload when present. (Extended in a later
--    migration to also stamp the account role.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Avatar storage: public bucket; signed-in users manage only their own
--    folder (objects stored under `<user-id>/...`).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- ---------------------------------------------------------------------------
-- Folded from 20260612000100_extensions_helpers.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0001 EXTENSIONS + SHARED HELPERS

-- earthdistance (and its dependency cube) powers the nearby_shops() distance
-- function without pulling in full PostGIS.
create extension if not exists cube with schema extensions;
create extension if not exists earthdistance with schema extensions;

-- Shared updated_at maintenance for every table that carries the column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Folded from 20260612000200_reference_catalog.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0002 REFERENCE CATALOG â€” shops / services / plans, seeded from the
-- frontend's src/data/catalog.js so existing string ids (and every deep link
-- built on them) stay stable. Public read; writes are denied here and granted
-- to owners/admins in the owners migration.

-- Membership tiers. discount_percent encodes the premium 10%-off rule that the
-- frontend currently hardcodes in getDiscount().
create table if not exists public.plans (
  id               text primary key,
  name             text not null,
  price            integer not null check (price >= 0), -- VND
  badge            boolean not null default false,
  discount_percent integer not null default 0 check (discount_percent between 0 and 100),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Service types are a global catalog (admin-managed); shops opt in via
-- shop_services. `icon` is a lucide-react icon name consumed by the UI.
create table if not exists public.services (
  id         text primary key,
  name       text not null,
  price      integer not null check (price >= 0), -- VND
  icon       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shops. owner_id/status exist from day one so owner onboarding (later
-- migration) is purely additive: seeded shops are owner-less and approved;
-- owner-submitted shops start pending and stay invisible to customers until an
-- admin approves. rating/reviews_count are system-derived (reviews migration),
-- never writable by owners.
create table if not exists public.shops (
  id             text primary key,
  owner_id       uuid references auth.users (id) on delete set null,
  status         text not null default 'pending'
                   check (status in ('draft', 'pending', 'approved', 'suspended')),
  name           text not null,
  district       text,
  address        text,
  phone          text,
  rating         numeric(2,1) not null default 0 check (rating between 0 and 5),
  reviews_count  integer not null default 0 check (reviews_count >= 0),
  starting_price integer check (starting_price >= 0), -- VND
  wait_minutes   integer check (wait_minutes >= 0),
  hours          text,
  is_open        boolean not null default true,
  promo          boolean not null default false,
  lat            double precision,
  lng            double precision,
  image_url      text,
  image_position text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.shop_services (
  shop_id    text not null references public.shops (id) on delete cascade,
  service_id text not null references public.services (id) on delete cascade,
  primary key (shop_id, service_id)
);

create index if not exists shops_status_idx on public.shops (status);
create index if not exists shops_owner_idx on public.shops (owner_id);

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

drop trigger if exists shops_set_updated_at on public.shops;
create trigger shops_set_updated_at
  before update on public.shops
  for each row execute function public.set_updated_at();

-- RLS: the catalog is public to read. plans/services are fully public;
-- customers only ever see approved shops (owner/admin visibility into
-- non-approved shops is added in the owners migration). No write policies
-- here, so all writes are denied except service_role / migrations.
alter table public.plans enable row level security;
alter table public.services enable row level security;
alter table public.shops enable row level security;
alter table public.shop_services enable row level security;

drop policy if exists "Plans are publicly readable" on public.plans;
create policy "Plans are publicly readable"
  on public.plans for select
  using (true);

drop policy if exists "Services are publicly readable" on public.services;
create policy "Services are publicly readable"
  on public.services for select
  using (true);

drop policy if exists "Approved shops are publicly readable" on public.shops;
create policy "Approved shops are publicly readable"
  on public.shops for select
  using (status = 'approved');

drop policy if exists "Shop services are publicly readable" on public.shop_services;
create policy "Shop services are publicly readable"
  on public.shop_services for select
  using (
    exists (
      select 1 from public.shops s
      where s.id = shop_services.shop_id and s.status = 'approved'
    )
  );

-- Seed: plans (prices from catalog.js: 99.000â‚« / 199.000â‚«).
insert into public.plans (id, name, price, badge, discount_percent) values
  ('basic',   'Basic',   99000,  false, 0),
  ('premium', 'Premium', 199000, true,  10)
on conflict (id) do nothing;

-- Seed: services (names match the app's English i18n labels in copy.js).
insert into public.services (id, name, price, icon) values
  ('exterior',  'Car Wash',          50000,  'Car'),
  ('interior',  'Interior Cleaning', 50000,  'Armchair'),
  ('detailing', 'Detailing',         100000, 'Sparkles'),
  ('wax',       'Wax Finish',        60000,  'ShieldCheck')
on conflict (id) do nothing;

-- Seed: shops. `distance`/`wait` strings from catalog.js are presentation â€”
-- distance is computed client-side from coordinates; wait becomes minutes.
-- reviews_count: "2.1k" â†’ 2100, "870" â†’ 870, "640" â†’ 640.
insert into public.shops
  (id, status, name, district, address, rating, reviews_count, starting_price,
   wait_minutes, hours, is_open, promo, lat, lng, image_position) values
  ('sparkle', 'approved', 'Sparkle Auto Wash', 'Tháº£o Äiá»n',
   '12 Nguyen Van Huong, Thu Duc, Ho Chi Minh City',
   4.9, 2100, 50000, 12, '07:00 - 22:00', true, true, 10.8045, 106.7385,
   'object-[58%_center]'),
  ('saigon', 'approved', 'Saigon Shine Hub', 'BÃ¬nh Tháº¡nh',
   '88 Xo Viet Nghe Tinh, Binh Thanh, Ho Chi Minh City',
   4.8, 870, 40000, 18, '24 Hrs', true, true, 10.8108, 106.7156,
   'object-[42%_center]'),
  ('lotus', 'approved', 'Lotus Detail Studio', 'District 7',
   '21 Nguyen Thi Thap, District 7, Ho Chi Minh City',
   4.7, 640, 60000, 25, '08:00 - 20:00', false, false, 10.7898, 106.7218,
   'object-[74%_center]')
on conflict (id) do nothing;

insert into public.shop_services (shop_id, service_id) values
  ('sparkle', 'exterior'), ('sparkle', 'interior'), ('sparkle', 'detailing'),
  ('saigon',  'exterior'), ('saigon',  'wax'),      ('saigon',  'interior'),
  ('lotus',   'detailing'),('lotus',   'wax'),      ('lotus',   'interior')
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- Folded from 20260612000300_profiles_evolve.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0003 PROFILES EVOLUTION â€” brings profiles up to what the frontend actually
-- uses today (VND wallet, language, pending voucher) and adds the role model
-- for the two-sided marketplace (customer / owner / admin).
--
-- `tokens` is intentionally KEPT for now: the running app still writes it.
-- It gets dropped when the frontend is wired to the new wallet.

alter table public.profiles
  add column if not exists funds integer not null default 0;
alter table public.profiles
  add column if not exists role text not null default 'customer';
alter table public.profiles
  add column if not exists lang text not null default 'en';
alter table public.profiles
  add column if not exists pending_voucher boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_funds_check') then
    alter table public.profiles
      add constraint profiles_funds_check check (funds >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('customer', 'owner', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_lang_check') then
    alter table public.profiles
      add constraint profiles_lang_check check (lang in ('en', 'vi'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_stamps_check') then
    alter table public.profiles
      add constraint profiles_stamps_check check (stamps between 0 and 5);
  end if;
  -- selected_plan now references the seeded plans table.
  if not exists (select 1 from pg_constraint where conname = 'profiles_selected_plan_fkey') then
    alter table public.profiles
      add constraint profiles_selected_plan_fkey
      foreign key (selected_plan) references public.plans (id);
  end if;
end;
$$;

-- Role helpers for RLS policies. SECURITY DEFINER so policies on OTHER tables
-- can read profiles.role without recursing into profiles' own RLS. STABLE so
-- the planner caches the result per statement.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Owner onboarding ("another way to sign up"): the dedicated owner sign-up
-- passes `signup_role: 'owner'` in the auth metadata; the trigger maps it to
-- the owner role server-side. Self-declared 'admin' is impossible â€” anything
-- other than 'owner' becomes 'customer'. Admins are promoted manually.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    case when new.raw_user_meta_data ->> 'signup_role' = 'owner'
         then 'owner' else 'customer' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Column-level write protection: role and funds must never be set directly by
-- clients (role changes are admin/manual; funds move only through the wallet
-- RPCs). Everything else the app edits today stays writable so the current
-- frontend keeps working untouched.
-- NOTE: tokens/stamps/voucher/pending_voucher/selected_plan/vehicle remain
-- client-writable ON PURPOSE for now â€” AppContext persists them directly.
-- Once the frontend moves to the booking/wallet RPCs, revoke those too.
revoke update on public.profiles from authenticated;
grant update (
  full_name, avatar_url, phone, car_model, lang,
  tokens, stamps, voucher, pending_voucher, selected_plan, vehicle
) on public.profiles to authenticated;


-- ---------------------------------------------------------------------------
-- Folded from 20260612000400_bookings.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0004 BOOKINGS + FAVORITES â€” the user-owned core. Bookings mirror the shape
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
-- table level so the wiring transition is gradual â€” but wallet/ledger writes
-- are RPC-only, so a direct insert can never mint funds.)
drop policy if exists "Users manage their own bookings" on public.bookings;
create policy "Users manage their own bookings"
  on public.bookings for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Owners can see (not edit) bookings made at their shops â€” feeds the owner
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


-- ---------------------------------------------------------------------------
-- Folded from 20260612000500_wallet.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0005 WALLET LEDGER â€” every movement of money is a row here; profiles.funds
-- is the running balance. CRITICAL: there are NO insert/update/delete policies
-- and no column grants â€” clients can only READ their own history. All writes
-- happen inside the SECURITY DEFINER wallet/booking RPCs, so a client can
-- never mint, alter, or erase money movements.

create table if not exists public.wallet_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  -- Signed VND: positive = money in (topup, refund), negative = money out (charge).
  amount     integer not null check (amount <> 0),
  kind       text not null check (kind in ('topup', 'charge', 'refund', 'adjustment')),
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists wallet_tx_user_idx
  on public.wallet_transactions (user_id, created_at desc);

alter table public.wallet_transactions enable row level security;

drop policy if exists "Users can view their own transactions" on public.wallet_transactions;
create policy "Users can view their own transactions"
  on public.wallet_transactions for select
  to authenticated
  using ((select auth.uid()) = user_id);


-- ---------------------------------------------------------------------------
-- Folded from 20260612000600_owners_approval.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0006 SHOP OWNERS + APPROVAL â€” the marketplace side. Owners (role granted at
-- sign-up via handle_new_user) create and manage their own shops; customers
-- only ever see status='approved'; admins moderate.
--
-- Defense in depth = column grants + RLS together:
--   * column grants stop owners from EVER writing rating / reviews_count /
--     owner_id / status by hand (status moves via RPCs below / admin)
--   * RLS rows-scope everything to the shop they own

-- Column-level write protection on shops.
revoke insert, update on public.shops from authenticated;
grant insert (
  id, owner_id, name, district, address, phone, starting_price, wait_minutes,
  hours, is_open, promo, lat, lng, image_url, image_position
) on public.shops to authenticated;
grant update (
  name, district, address, phone, starting_price, wait_minutes,
  hours, is_open, promo, lat, lng, image_url, image_position
) on public.shops to authenticated;

-- Owners and admins can see non-approved shops (their drafts / the mod queue).
drop policy if exists "Owners can view their own shops" on public.shops;
create policy "Owners can view their own shops"
  on public.shops for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Admins can view all shops" on public.shops;
create policy "Admins can view all shops"
  on public.shops for select
  to authenticated
  using (public.is_admin());

-- Owners create their own shops. They cannot set status/rating (no column
-- grant) â€” new shops land in the default 'pending' state, invisible to
-- customers until approved.
drop policy if exists "Owners can create their own shops" on public.shops;
create policy "Owners can create their own shops"
  on public.shops for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.current_user_role() in ('owner', 'admin')
  );

drop policy if exists "Owners can update their own shops" on public.shops;
create policy "Owners can update their own shops"
  on public.shops for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can delete their own shops" on public.shops;
create policy "Owners can delete their own shops"
  on public.shops for delete
  to authenticated
  using (owner_id = (select auth.uid()) and status <> 'approved');

-- Admin moderation: service_role bypasses RLS, but admins work from the app
-- with their own JWT, so they need an explicit row policy. Column grants are
-- role-wide (can't differ per user), so admins edit the same columns as
-- owners; status transitions go through set_shop_status() below and rating /
-- reviews_count move only via the reviews trigger.
drop policy if exists "Admins manage all shops" on public.shops;
create policy "Admins manage all shops"
  on public.shops for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Status transitions live in a SECURITY DEFINER function so the rules are in
-- one audited place: owners may submit (draftâ†’pending) or unpublish their own
-- shop; only admins approve or suspend.
create or replace function public.set_shop_status(p_shop_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop public.shops%rowtype;
  v_role text := public.current_user_role();
begin
  if p_status not in ('draft', 'pending', 'approved', 'suspended') then
    raise exception 'invalid status %', p_status;
  end if;
  select * into v_shop from public.shops where id = p_shop_id;
  if not found then
    raise exception 'shop % not found', p_shop_id;
  end if;

  if v_role = 'admin' then
    null; -- admins may set any status
  elsif v_shop.owner_id = (select auth.uid()) and p_status in ('draft', 'pending') then
    null; -- owners may save as draft or submit for review
  else
    raise exception 'not allowed';
  end if;

  update public.shops set status = p_status where id = p_shop_id;
end;
$$;

revoke execute on function public.set_shop_status(text, text) from public, anon;
grant execute on function public.set_shop_status(text, text) to authenticated;

-- Owners manage the services their shop offers (rows in the join table).
drop policy if exists "Owners manage their shop services" on public.shop_services;
create policy "Owners manage their shop services"
  on public.shop_services for all
  to authenticated
  using (
    exists (
      select 1 from public.shops s
      where s.id = shop_services.shop_id
        and (s.owner_id = (select auth.uid()) or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.shops s
      where s.id = shop_services.shop_id
        and (s.owner_id = (select auth.uid()) or public.is_admin())
    )
  );

-- Owners can also see the service catalog rows regardless of shop status
-- (services are already publicly readable). Admin-only writes on the global
-- catalogs (plans / services):
drop policy if exists "Admins manage plans" on public.plans;
create policy "Admins manage plans"
  on public.plans for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage services" on public.services;
create policy "Admins manage services"
  on public.services for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Shop photos: public-read bucket; an owner uploads under their shop's folder
-- (`<shop-id>/...`) and only for shops they actually own. Mirrors avatars.
insert into storage.buckets (id, name, public)
values ('shop-photos', 'shop-photos', true)
on conflict (id) do nothing;

drop policy if exists "Shop photos are publicly readable" on storage.objects;
create policy "Shop photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'shop-photos');

drop policy if exists "Owners can upload photos for their shops" on storage.objects;
create policy "Owners can upload photos for their shops"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'shop-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can update photos for their shops" on storage.objects;
create policy "Owners can update photos for their shops"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'shop-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can delete photos for their shops" on storage.objects;
create policy "Owners can delete photos for their shops"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'shop-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- Folded from 20260612000700_reviews.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0007 REVIEWS â€” makes shops.rating / reviews_count real, system-derived
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


-- ---------------------------------------------------------------------------
-- Folded from 20260612000800_rpcs.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0008 ATOMIC RPCs â€” the only write path for money and loyalty. Each function
-- is SECURITY DEFINER (the ledger has no client write policies), validates
-- auth.uid() itself, and locks the caller's profile row so concurrent calls
-- can't double-spend or double-stamp. Mirrors the frontend rules in
-- src/lib/AppContext.jsx (confirmBooking / cancelBooking / topUpFunds).

-- Top up the wallet. Payment processing is out of scope (the app's top-up is
-- explicitly fake today) â€” when a PSP is integrated, its webhook calls this
-- with the captured amount.
create or replace function public.top_up(p_amount integer, p_note text default null)
returns integer -- new balance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_funds integer;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception 'invalid amount';
  end if;

  select funds into v_funds from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;

  insert into public.wallet_transactions (user_id, amount, kind, note)
  values (v_uid, p_amount, 'topup', p_note);

  update public.profiles set funds = funds + p_amount where id = v_uid
  returning funds into v_funds;

  return v_funds;
end;
$$;

-- Create a booking: price from the catalog (server-side, never trusted from
-- the client), premium discount from plans.discount_percent, charge the
-- wallet (or burn the free-wash voucher), award the loyalty stamp.
create or replace function public.create_booking(
  p_shop_id     text,
  p_date        date,
  p_slot        text,
  p_service_ids text[],
  p_use_voucher boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_subtotal integer;
  v_discount integer := 0;
  v_total    integer;
  v_free     boolean := false;
  v_stamp    boolean := false;
  v_booking  uuid;
  v_pct      integer;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'no services selected';
  end if;
  if not exists (
    select 1 from public.shops where id = p_shop_id and status = 'approved'
  ) then
    raise exception 'shop not available';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;

  select coalesce(sum(price), 0) into v_subtotal
  from public.services where id = any (p_service_ids);
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  -- Premium-style discount, rounded to the nearest 1.000â‚« (same as the UI).
  select coalesce(discount_percent, 0) into v_pct
  from public.plans where id = v_profile.selected_plan;
  if coalesce(v_pct, 0) > 0 then
    v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
  end if;
  v_total := greatest(0, v_subtotal - v_discount);

  if p_use_voucher then
    if not v_profile.voucher then raise exception 'no voucher available'; end if;
    v_free := true;
    v_total := 0;
  end if;

  if not v_free and v_profile.funds < v_total then
    raise exception 'insufficient funds';
  end if;

  insert into public.bookings
    (user_id, shop_id, scheduled_date, slot_time, plan_id, total,
     free_wash, earned_stamp, status)
  values
    (v_uid, p_shop_id, p_date, p_slot, v_profile.selected_plan, v_total,
     v_free, not v_free, 'upcoming')
  returning id into v_booking;

  insert into public.booking_services (booking_id, service_id, unit_price)
  select v_booking, s.id, s.price
  from public.services s where s.id = any (p_service_ids);

  if v_free then
    -- Burn the voucher; the loyalty card restarts.
    update public.profiles
    set voucher = false, pending_voucher = false, stamps = 0
    where id = v_uid;
  else
    if v_total > 0 then
      insert into public.wallet_transactions (user_id, booking_id, amount, kind)
      values (v_uid, v_booking, -v_total, 'charge');
    end if;
    v_stamp := true;
    update public.profiles
    set funds = funds - v_total,
        stamps = least(5, stamps + 1),
        voucher = (least(5, stamps + 1) >= 5)
    where id = v_uid;
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  return jsonb_build_object(
    'booking_id', v_booking,
    'total', v_total,
    'free_wash', v_free,
    'earned_stamp', v_stamp,
    'funds', v_profile.funds,
    'stamps', v_profile.stamps,
    'voucher', v_profile.voucher
  );
end;
$$;

-- Cancel an upcoming booking: refund what was paid, reverse the stamp (and a
-- voucher unlocked by it), or restore the voucher if this was the free wash.
create or replace function public.cancel_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not signed in'; end if;

  select * into v_booking from public.bookings
  where id = p_booking_id and user_id = v_uid
  for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status <> 'upcoming' then
    raise exception 'only upcoming bookings can be cancelled';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;

  update public.bookings set status = 'cancelled' where id = p_booking_id;

  if v_booking.total > 0 then
    insert into public.wallet_transactions (user_id, booking_id, amount, kind)
    values (v_uid, p_booking_id, v_booking.total, 'refund');
  end if;

  update public.profiles
  set funds = funds + v_booking.total,
      -- A cancelled free wash restores the voucher (card stays restarted);
      -- a cancelled stamp-earning booking takes its stamp (and any voucher
      -- that stamp unlocked) back.
      voucher = case
        when v_booking.free_wash then true
        when v_booking.earned_stamp then (greatest(0, stamps - 1) >= 5)
        else voucher end,
      stamps = case
        when v_booking.earned_stamp then greatest(0, stamps - 1)
        else stamps end
  where id = v_uid;

  select * into v_profile from public.profiles where id = v_uid;
  return jsonb_build_object(
    'refunded', v_booking.total,
    'funds', v_profile.funds,
    'stamps', v_profile.stamps,
    'voucher', v_profile.voucher
  );
end;
$$;

-- Map/discovery: approved shops within a radius, nearest first. SECURITY
-- INVOKER on purpose â€” the shops RLS (approved-only for customers) applies.
create or replace function public.nearby_shops(
  p_lat float8, p_lng float8, p_radius_km float8 default 5.0
)
returns table (
  id text, name text, district text, address text, rating numeric,
  reviews_count integer, starting_price integer, wait_minutes integer,
  hours text, is_open boolean, promo boolean, lat float8, lng float8,
  image_url text, image_position text, distance_km float8
)
language sql
stable
set search_path = public, extensions
as $$
  select s.id, s.name, s.district, s.address, s.rating, s.reviews_count,
         s.starting_price, s.wait_minutes, s.hours, s.is_open, s.promo,
         s.lat, s.lng, s.image_url, s.image_position,
         earth_distance(ll_to_earth(s.lat, s.lng), ll_to_earth(p_lat, p_lng)) / 1000.0
           as distance_km
  from public.shops s
  where s.lat is not null and s.lng is not null
    and earth_distance(ll_to_earth(s.lat, s.lng), ll_to_earth(p_lat, p_lng))
        <= p_radius_km * 1000.0
  order by distance_km;
$$;

-- Money-moving functions: signed-in users only. nearby_shops is fine for anon
-- (the app browses signed-out) â€” RLS still hides non-approved shops.
revoke execute on function public.top_up(integer, text) from public, anon;
revoke execute on function public.create_booking(text, date, text, text[], boolean) from public, anon;
revoke execute on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.top_up(integer, text) to authenticated;
grant execute on function public.create_booking(text, date, text, text[], boolean) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.nearby_shops(float8, float8, float8) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Folded from 20260612000900_hardening.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0009 HARDENING â€” clears the security-advisor warnings and locks down
-- internal functions that should never be callable through PostgREST.

-- handle_new_user is invoked by the auth.users trigger only; it must not be
-- exposed as /rest/v1/rpc/handle_new_user. (Triggers fire with the function
-- owner's rights, so revoking EXECUTE does not affect signups.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Same for the other trigger-only functions.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.recompute_shop_rating() from public, anon, authenticated;

-- NOT DOABLE IN SQL â€” flip in the dashboard:
--   Authentication â†’ Sign In / Providers â†’ "Leaked password protection"
-- (the third advisor warning: checks passwords against HaveIBeenPwned).


-- ---------------------------------------------------------------------------
-- Folded from 20260612001000_storage_listing_hardening.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0010 STORAGE LISTING HARDENING â€” clears the public_bucket_allows_listing
-- advisor warnings. Public buckets serve objects at /object/public/<path>
-- WITHOUT consulting storage.objects RLS, so the app's getPublicUrl() flow
-- (avatars, shop photos) keeps working. The broad SELECT policies only enabled
-- client-side .list()/.download() â€” which the app never uses â€” and let anyone
-- enumerate every file in the bucket.
drop policy if exists "Avatar images are publicly readable" on storage.objects;
drop policy if exists "Shop photos are publicly readable" on storage.objects;


-- ---------------------------------------------------------------------------
-- Folded from 20260612001100_update_booking_rpc.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0011 update_booking RPC â€” the edit-an-upcoming-booking write path the
-- frontend's BookingDetailScreen needs. Mirrors the local updateBooking() in
-- AppContext: reprice under the booking's ORIGINAL plan (not the user's current
-- plan), adjust the wallet by only the delta, and never touch loyalty stamps
-- (an edit neither earns nor burns a stamp). Owner-scoped + row-locked.
create or replace function public.update_booking(
  p_booking_id  uuid,
  p_date        date,
  p_slot        text,
  p_service_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_booking  public.bookings%rowtype;
  v_subtotal integer;
  v_pct      integer := 0;
  v_discount integer := 0;
  v_total    integer;
  v_delta    integer;       -- old - new : positive = refund, negative = extra charge
  v_funds    integer;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'no services selected';
  end if;

  select * into v_booking from public.bookings
  where id = p_booking_id and user_id = v_uid
  for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status <> 'upcoming' then
    raise exception 'only upcoming bookings can be edited';
  end if;

  select coalesce(sum(price), 0) into v_subtotal
  from public.services where id = any (p_service_ids);
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  -- Reprice under the plan the booking was made on (mirrors the UI: 10% off,
  -- rounded to the nearest 1.000â‚«).
  select coalesce(discount_percent, 0) into v_pct
  from public.plans where id = v_booking.plan_id;
  if coalesce(v_pct, 0) > 0 then
    v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
  end if;
  v_total := greatest(0, v_subtotal - v_discount);

  -- A free-wash booking stays free on edit (never retro-charges the voucher).
  if v_booking.free_wash then
    v_total := 0;
  end if;

  v_delta := v_booking.total - v_total;
  select funds into v_funds from public.profiles where id = v_uid for update;
  if v_delta < 0 and v_funds < -v_delta then
    raise exception 'insufficient funds';
  end if;

  update public.bookings
  set scheduled_date = p_date, slot_time = p_slot, total = v_total
  where id = p_booking_id;

  delete from public.booking_services where booking_id = p_booking_id;
  insert into public.booking_services (booking_id, service_id, unit_price)
  select p_booking_id, s.id, s.price
  from public.services s where s.id = any (p_service_ids);

  if v_delta <> 0 then
    insert into public.wallet_transactions (user_id, booking_id, amount, kind)
    values (v_uid, p_booking_id, v_delta, case when v_delta > 0 then 'refund' else 'charge' end);
    update public.profiles set funds = funds + v_delta where id = v_uid
    returning funds into v_funds;
  end if;

  return jsonb_build_object('booking_id', p_booking_id, 'total', v_total,
                            'delta', v_delta, 'funds', v_funds);
end;
$$;

revoke execute on function public.update_booking(uuid, date, text, text[]) from public, anon;
grant execute on function public.update_booking(uuid, date, text, text[]) to authenticated;


-- ---------------------------------------------------------------------------
-- Folded from 20260615000000_admin_profiles_read.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0012 ADMIN PROFILES READ â€” the moderation console needs to show who owns each
-- shop in the approval queue. profiles SELECT was self-only ("Profiles are
-- viewable by their owner"); add an admin-scoped read alongside it.
--
-- is_admin() is SECURITY DEFINER and reads current_user_role() (also definer),
-- so this policy does not recurse into profiles' own RLS.
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------------
-- Folded from 20260615000100_owner_applications.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0013 OWNER APPLICATIONS â€” customers apply to run a car wash from their profile;
-- an admin reviews and approves. owner_status tracks the lifecycle; the role
-- only flips to 'owner' on approval. Not in the profiles UPDATE grant, so clients
-- can't self-set it â€” these SECURITY DEFINER RPCs are the only writers.
alter table public.profiles
  add column if not exists owner_status text not null default 'none';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_owner_status_check') then
    alter table public.profiles
      add constraint profiles_owner_status_check
      check (owner_status in ('none', 'pending', 'approved', 'rejected'));
  end if;
end;
$$;

-- A signed-in customer applies. No role change yet. Idempotent: only moves a
-- fresh/rejected application to pending (an approved owner stays approved).
create or replace function public.apply_for_owner()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set owner_status = 'pending'
    where id = (select auth.uid())
      and owner_status in ('none', 'rejected');
end;
$$;

revoke execute on function public.apply_for_owner() from public, anon;
grant execute on function public.apply_for_owner() to authenticated;

-- Admin decision. Approving grants the owner role; rejecting/clearing an owner
-- drops them back to customer.
create or replace function public.set_owner_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if p_status not in ('none', 'pending', 'approved', 'rejected') then
    raise exception 'invalid owner status %', p_status;
  end if;
  update public.profiles
    set owner_status = p_status,
        role = case
                 when p_status = 'approved' then 'owner'
                 when p_status in ('rejected', 'none') and role = 'owner' then 'customer'
                 else role
               end
    where id = p_user_id;
end;
$$;

revoke execute on function public.set_owner_status(uuid, text) from public, anon;
grant execute on function public.set_owner_status(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- Folded from 20260615000200_shop_setup.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0014 SHOP SETUP â€” structured hours, per-slot capacity, special-day overrides,
-- custom services, and an explicit "published" gate (release publicly) that is
-- separate from is_open (the live open/closed badge).

alter table public.shops add column if not exists open_time time;
alter table public.shops add column if not exists close_time time;
alter table public.shops add column if not exists max_cars_per_slot integer not null default 1;
alter table public.shops add column if not exists slot_minutes integer not null default 60;
-- Released publicly? New shops stay unpublished until the owner releases them.
alter table public.shops add column if not exists published boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shops_max_cars_check') then
    alter table public.shops add constraint shops_max_cars_check check (max_cars_per_slot >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shops_slot_minutes_check') then
    alter table public.shops add constraint shops_slot_minutes_check check (slot_minutes between 15 and 240);
  end if;
end;
$$;

-- Keep existing approved (seeded) shops visible: they're already live.
update public.shops set published = true where status = 'approved';

-- Owners may write the new scheduling columns (mirrors the 0006 column grants).
grant insert (open_time, close_time, max_cars_per_slot, slot_minutes) on public.shops to authenticated;
grant update (open_time, close_time, max_cars_per_slot, slot_minutes) on public.shops to authenticated;

-- Release-publicly is gated: publishing requires an approved shop. Owners can
-- always unpublish. SECURITY DEFINER so the rule lives in one place (published
-- is deliberately NOT in the column grant).
create or replace function public.set_shop_published(p_shop_id text, p_published boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop public.shops%rowtype;
begin
  select * into v_shop from public.shops where id = p_shop_id;
  if not found then raise exception 'shop % not found', p_shop_id; end if;
  if not (v_shop.owner_id = (select auth.uid()) or public.is_admin()) then
    raise exception 'not allowed';
  end if;
  if p_published and v_shop.status <> 'approved' then
    raise exception 'shop must be approved before it can be released publicly';
  end if;
  update public.shops set published = p_published where id = p_shop_id;
end;
$$;

revoke execute on function public.set_shop_published(text, boolean) from public, anon;
grant execute on function public.set_shop_published(text, boolean) to authenticated;

-- Special-day overrides: closed days or a custom cap. Higher priority than the
-- normal per-slot limit (enforced in create_booking).
create table if not exists public.shop_slot_overrides (
  shop_id           text not null references public.shops(id) on delete cascade,
  date              date not null,
  is_closed         boolean not null default false,
  max_cars_per_slot integer check (max_cars_per_slot >= 1),
  created_at        timestamptz not null default now(),
  primary key (shop_id, date)
);
alter table public.shop_slot_overrides enable row level security;

drop policy if exists "Overrides readable for approved shops" on public.shop_slot_overrides;
create policy "Overrides readable for approved shops"
  on public.shop_slot_overrides for select
  using (
    exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
    or exists (select 1 from public.shops s where s.id = shop_id and (s.owner_id = (select auth.uid()) or public.is_admin()))
  );

drop policy if exists "Owners manage their overrides" on public.shop_slot_overrides;
create policy "Owners manage their overrides"
  on public.shop_slot_overrides for all to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and (s.owner_id = (select auth.uid()) or public.is_admin())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and (s.owner_id = (select auth.uid()) or public.is_admin())));

-- Custom per-shop services (in addition to the shared catalogue). is_offer marks
-- a promotional / discounted service.
create table if not exists public.shop_custom_services (
  id         uuid primary key default gen_random_uuid(),
  shop_id    text not null references public.shops(id) on delete cascade,
  name       text not null,
  price      integer not null check (price >= 0),
  is_offer   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.shop_custom_services enable row level security;
create index if not exists shop_custom_services_shop_idx on public.shop_custom_services(shop_id);

drop policy if exists "Custom services readable for approved shops" on public.shop_custom_services;
create policy "Custom services readable for approved shops"
  on public.shop_custom_services for select
  using (
    exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
    or exists (select 1 from public.shops s where s.id = shop_id and (s.owner_id = (select auth.uid()) or public.is_admin()))
  );

drop policy if exists "Owners manage their custom services" on public.shop_custom_services;
create policy "Owners manage their custom services"
  on public.shop_custom_services for all to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and (s.owner_id = (select auth.uid()) or public.is_admin())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and (s.owner_id = (select auth.uid()) or public.is_admin())));


-- ---------------------------------------------------------------------------
-- Folded from 20260615000300_booking_capacity.sql during migration-history repair.
-- ---------------------------------------------------------------------------
-- 0015 BOOKING CAPACITY â€” bookings now respect the "release publicly" gate and a
-- per-slot car limit, where a special-day override (closed or custom cap) wins
-- over the shop's normal limit. Replaces create_booking + update_booking; all
-- other logic (pricing, wallet, stamps) is unchanged from 0008 / 0011.

create or replace function public.create_booking(
  p_shop_id     text,
  p_date        date,
  p_slot        text,
  p_service_ids text[],
  p_use_voucher boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_subtotal integer;
  v_discount integer := 0;
  v_total    integer;
  v_free     boolean := false;
  v_stamp    boolean := false;
  v_booking  uuid;
  v_pct      integer;
  v_closed   boolean;
  v_cap      integer;
  v_count    integer;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'no services selected';
  end if;
  if not exists (
    select 1 from public.shops where id = p_shop_id and status = 'approved' and published
  ) then
    raise exception 'shop not available';
  end if;

  select coalesce(o.is_closed, false),
         coalesce(o.max_cars_per_slot, s.max_cars_per_slot)
    into v_closed, v_cap
  from public.shops s
  left join public.shop_slot_overrides o on o.shop_id = s.id and o.date = p_date
  where s.id = p_shop_id;
  if v_closed then raise exception 'shop closed on this date'; end if;

  select count(*) into v_count
  from public.bookings
  where shop_id = p_shop_id and scheduled_date = p_date and slot_time = p_slot
    and status <> 'cancelled';
  if v_count >= coalesce(v_cap, 1) then
    raise exception 'slot full';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;

  select coalesce(sum(price), 0) into v_subtotal
  from public.services where id = any (p_service_ids);
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  select coalesce(discount_percent, 0) into v_pct
  from public.plans where id = v_profile.selected_plan;
  if coalesce(v_pct, 0) > 0 then
    v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
  end if;
  v_total := greatest(0, v_subtotal - v_discount);

  if p_use_voucher then
    if not v_profile.voucher then raise exception 'no voucher available'; end if;
    v_free := true;
    v_total := 0;
  end if;

  if not v_free and v_profile.funds < v_total then
    raise exception 'insufficient funds';
  end if;

  insert into public.bookings
    (user_id, shop_id, scheduled_date, slot_time, plan_id, total,
     free_wash, earned_stamp, status)
  values
    (v_uid, p_shop_id, p_date, p_slot, v_profile.selected_plan, v_total,
     v_free, not v_free, 'upcoming')
  returning id into v_booking;

  insert into public.booking_services (booking_id, service_id, unit_price)
  select v_booking, s.id, s.price
  from public.services s where s.id = any (p_service_ids);

  if v_free then
    update public.profiles
    set voucher = false, pending_voucher = false, stamps = 0
    where id = v_uid;
  else
    if v_total > 0 then
      insert into public.wallet_transactions (user_id, booking_id, amount, kind)
      values (v_uid, v_booking, -v_total, 'charge');
    end if;
    v_stamp := true;
    update public.profiles
    set funds = funds - v_total,
        stamps = least(5, stamps + 1),
        voucher = (least(5, stamps + 1) >= 5)
    where id = v_uid;
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  return jsonb_build_object(
    'booking_id', v_booking, 'total', v_total, 'free_wash', v_free,
    'earned_stamp', v_stamp, 'funds', v_profile.funds,
    'stamps', v_profile.stamps, 'voucher', v_profile.voucher
  );
end;
$$;

create or replace function public.update_booking(
  p_booking_id  uuid,
  p_date        date,
  p_slot        text,
  p_service_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_booking  public.bookings%rowtype;
  v_subtotal integer;
  v_pct      integer := 0;
  v_discount integer := 0;
  v_total    integer;
  v_delta    integer;
  v_funds    integer;
  v_closed   boolean;
  v_cap      integer;
  v_count    integer;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'no services selected';
  end if;

  select * into v_booking from public.bookings
  where id = p_booking_id and user_id = v_uid
  for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status <> 'upcoming' then
    raise exception 'only upcoming bookings can be edited';
  end if;

  select coalesce(o.is_closed, false),
         coalesce(o.max_cars_per_slot, s.max_cars_per_slot)
    into v_closed, v_cap
  from public.shops s
  left join public.shop_slot_overrides o on o.shop_id = s.id and o.date = p_date
  where s.id = v_booking.shop_id;
  if v_closed then raise exception 'shop closed on this date'; end if;
  select count(*) into v_count
  from public.bookings
  where shop_id = v_booking.shop_id and scheduled_date = p_date and slot_time = p_slot
    and status <> 'cancelled' and id <> p_booking_id;
  if v_count >= coalesce(v_cap, 1) then
    raise exception 'slot full';
  end if;

  select coalesce(sum(price), 0) into v_subtotal
  from public.services where id = any (p_service_ids);
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  select coalesce(discount_percent, 0) into v_pct
  from public.plans where id = v_booking.plan_id;
  if coalesce(v_pct, 0) > 0 then
    v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
  end if;
  v_total := greatest(0, v_subtotal - v_discount);

  if v_booking.free_wash then v_total := 0; end if;

  v_delta := v_booking.total - v_total;
  select funds into v_funds from public.profiles where id = v_uid for update;
  if v_delta < 0 and v_funds < -v_delta then
    raise exception 'insufficient funds';
  end if;

  update public.bookings
  set scheduled_date = p_date, slot_time = p_slot, total = v_total
  where id = p_booking_id;

  delete from public.booking_services where booking_id = p_booking_id;
  insert into public.booking_services (booking_id, service_id, unit_price)
  select p_booking_id, s.id, s.price
  from public.services s where s.id = any (p_service_ids);

  if v_delta <> 0 then
    insert into public.wallet_transactions (user_id, booking_id, amount, kind)
    values (v_uid, p_booking_id, v_delta, case when v_delta > 0 then 'refund' else 'charge' end);
    update public.profiles set funds = funds + v_delta where id = v_uid
    returning funds into v_funds;
  end if;

  return jsonb_build_object('booking_id', p_booking_id, 'total', v_total,
                            'delta', v_delta, 'funds', v_funds);
end;
$$;
