-- FIX SHOP PHOTOS ANON READ
-- Keep the public catalog read policy independent of admin-only helpers.

drop policy if exists "Shop photos readable for approved shops" on public.shop_photos;
create policy "Shop photos readable for approved shops"
  on public.shop_photos for select
  using (
    exists (
      select 1
      from public.shops s
      where s.id = shop_id and s.status = 'approved'
    )
    or exists (
      select 1
      from public.shops s
      where s.id = shop_id and s.owner_id = (select auth.uid())
    )
  );
