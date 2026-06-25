-- 0051 BOOKING CONFIRMATION — hardening follow-up (addresses security advisors
-- after 20260625090000_booking_confirmation.sql).

-- 1. set_booking_expected_plate() is a TRIGGER function — it must never be
-- callable over the REST API. CREATE FUNCTION grants EXECUTE to PUBLIC by
-- default; revoke it. The BEFORE INSERT trigger still fires (triggers run the
-- function regardless of EXECUTE grants).
revoke execute on function public.set_booking_expected_plate() from public, anon, authenticated;

-- 2. Drop the broad public-read (listing) policy on the booking-photos bucket.
-- The bucket is public, so object URLs from getPublicUrl still resolve via the
-- /object/public/<path> endpoint WITHOUT this policy; removing it only stops
-- clients from enumerating the bucket. Arrival/completion photos include the
-- customer's car and plate, so non-enumerable storage is the right default and
-- matches the repo's existing hardening (see fix_shop_photos_anon_read).
drop policy if exists "Booking photos are publicly readable" on storage.objects;
