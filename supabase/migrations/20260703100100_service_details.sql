-- 0064 PER-SERVICE DETAILS (description + photo/video)
-- Custom services already carry image_url; add description + video_url. The shared
-- catalogue services (public.services) can't hold per-shop text/media, so add a
-- per-shop details table for them. Display-only — does not affect pricing.

alter table public.shop_custom_services
  add column if not exists description text,
  add column if not exists video_url   text;

create table if not exists public.shop_service_details (
  shop_id     text not null references public.shops(id) on delete cascade,
  service_id  text not null references public.services(id) on delete cascade,
  description text,
  image_url   text,
  video_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (shop_id, service_id)
);
alter table public.shop_service_details enable row level security;

-- Mirror shop_custom_services: readable on approved shops (or by owner/admin),
-- writable only by the shop owner or an admin.
drop policy if exists "Service details readable for approved shops" on public.shop_service_details;
create policy "Service details readable for approved shops"
  on public.shop_service_details for select
  using (
    exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
    or exists (select 1 from public.shops s where s.id = shop_id and (s.owner_id = (select auth.uid()) or public.is_admin()))
  );

drop policy if exists "Owners manage their service details" on public.shop_service_details;
create policy "Owners manage their service details"
  on public.shop_service_details for all to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and (s.owner_id = (select auth.uid()) or public.is_admin())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and (s.owner_id = (select auth.uid()) or public.is_admin())));

notify pgrst, 'reload schema';
