-- 0010 STORAGE LISTING HARDENING — clears the public_bucket_allows_listing
-- advisor warnings. Public buckets serve objects at /object/public/<path>
-- WITHOUT consulting storage.objects RLS, so the app's getPublicUrl() flow
-- (avatars, shop photos) keeps working. The broad SELECT policies only enabled
-- client-side .list()/.download() — which the app never uses — and let anyone
-- enumerate every file in the bucket.
drop policy if exists "Avatar images are publicly readable" on storage.objects;
drop policy if exists "Shop photos are publicly readable" on storage.objects;
