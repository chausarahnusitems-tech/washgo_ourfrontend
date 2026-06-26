-- 0058 FIX STORAGE OWNER-UPLOAD RLS SHADOWING
--
-- The owner-by-shop storage policies for booking-photos / shop-photos /
-- shop-videos were written as:
--     exists (select 1 from public.shops s
--             where s.id = (storage.foldername(name))[1] ...)
-- Inside that subquery the unqualified `name` binds to public.shops.name (the
-- shop's display name, e.g. "Prisma") — NOT storage.objects.name (the uploaded
-- file path). So foldername() got "Prisma" (no folder), [1] was NULL, the EXISTS
-- was always false, and EVERY owner upload failed with
-- "new row violates row-level security policy".
--
-- Fix: qualify the column as storage.objects.name so it resolves to the file
-- path. Recreated for all three buckets × insert/update/delete.

-- ---- booking-photos --------------------------------------------------------
drop policy if exists "Owners can upload booking photos" on storage.objects;
create policy "Owners can upload booking photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booking-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can update booking photos" on storage.objects;
create policy "Owners can update booking photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'booking-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can delete booking photos" on storage.objects;
create policy "Owners can delete booking photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'booking-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

-- ---- shop-photos -----------------------------------------------------------
drop policy if exists "Owners can upload photos for their shops" on storage.objects;
create policy "Owners can upload photos for their shops"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can update photos for their shops" on storage.objects;
create policy "Owners can update photos for their shops"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'shop-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can delete photos for their shops" on storage.objects;
create policy "Owners can delete photos for their shops"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shop-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

-- ---- shop-videos -----------------------------------------------------------
drop policy if exists "Owners can upload videos for their shops" on storage.objects;
create policy "Owners can upload videos for their shops"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-videos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can update videos for their shops" on storage.objects;
create policy "Owners can update videos for their shops"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'shop-videos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can delete videos for their shops" on storage.objects;
create policy "Owners can delete videos for their shops"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'shop-videos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = (select auth.uid())
    )
  );
