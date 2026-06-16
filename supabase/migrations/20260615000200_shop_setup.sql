-- 0014 SHOP SETUP — structured hours, per-slot capacity, special-day overrides,
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
