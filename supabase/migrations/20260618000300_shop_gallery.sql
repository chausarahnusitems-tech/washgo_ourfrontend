-- 0045 SHOP GALLERY — one-to-many photos per shop (the single shops.image_url
-- stays as the denormalised cover for fast card reads). Files live in the
-- existing 'shop-photos' bucket; this table records each photo + ordering + which
-- one is the cover. RLS mirrors shop_custom_services (0014).

create table if not exists public.shop_photos (
  id         uuid primary key default gen_random_uuid(),
  shop_id    text not null references public.shops(id) on delete cascade,
  url        text not null,
  sort_order integer not null default 0,
  is_cover   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.shop_photos enable row level security;
create index if not exists shop_photos_shop_idx on public.shop_photos(shop_id);

-- NOTE: the public catalog embeds shop_photos, so this SELECT policy runs as the
-- anon role. It must NOT call is_admin() (anon lacks EXECUTE on it → the whole
-- catalog query fails). Admins/owners manage via the FOR ALL policy below.
drop policy if exists "Shop photos readable for approved shops" on public.shop_photos;
create policy "Shop photos readable for approved shops"
  on public.shop_photos for select
  using (
    exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
    or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid()))
  );

drop policy if exists "Owners manage their shop photos" on public.shop_photos;
create policy "Owners manage their shop photos"
  on public.shop_photos for all to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and (s.owner_id = (select auth.uid()) or public.is_admin())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and (s.owner_id = (select auth.uid()) or public.is_admin())));
