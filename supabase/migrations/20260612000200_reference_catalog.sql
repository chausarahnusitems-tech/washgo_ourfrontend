-- 0002 REFERENCE CATALOG — shops / services / plans, seeded from the
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

-- Seed: plans (prices from catalog.js: 99.000₫ / 199.000₫).
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

-- Seed: shops. `distance`/`wait` strings from catalog.js are presentation —
-- distance is computed client-side from coordinates; wait becomes minutes.
-- reviews_count: "2.1k" → 2100, "870" → 870, "640" → 640.
insert into public.shops
  (id, status, name, district, address, rating, reviews_count, starting_price,
   wait_minutes, hours, is_open, promo, lat, lng, image_position) values
  ('sparkle', 'approved', 'Sparkle Auto Wash', 'Thảo Điền',
   '12 Nguyen Van Huong, Thu Duc, Ho Chi Minh City',
   4.9, 2100, 50000, 12, '07:00 - 22:00', true, true, 10.8045, 106.7385,
   'object-[58%_center]'),
  ('saigon', 'approved', 'Saigon Shine Hub', 'Bình Thạnh',
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
