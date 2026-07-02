-- Vehicle photos: public-read bucket; a signed-in user manages only their own
-- folder (objects stored under `<user-id>/...`). Mirrors the avatars bucket.
-- Used by the booking page / vehicle editor to attach a photo to the saved
-- vehicle profile (persisted in profiles.vehicle->>'photoUrl').
insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', true)
on conflict (id) do nothing;

drop policy if exists "Vehicle photos are publicly readable" on storage.objects;
create policy "Vehicle photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'vehicle-photos');

drop policy if exists "Users can upload their own vehicle photo" on storage.objects;
create policy "Users can upload their own vehicle photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their own vehicle photo" on storage.objects;
create policy "Users can update their own vehicle photo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own vehicle photo" on storage.objects;
create policy "Users can delete their own vehicle photo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
