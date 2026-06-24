-- 0048 RESET fake/test data + rebrand the 22 An Phú hub to "Prisma" (item 24).
-- DESTRUCTIVE — removes the seeded demo shops, the leftover test shops, and ALL
-- test conversations/bookings. KEEPS the 77 real imported directory listings.
-- Order matters: shops→bookings is ON DELETE NO ACTION, so bookings go first.

-- 1) Remove all test bookings (cascades booking_services + per-booking
--    conversations; nulls the SET NULL refs on reviews/wallet_transactions).
delete from public.bookings;

-- 2) Remove all remaining test conversations (cascades messages, participants,
--    reads, reports, reviews, hidden).
delete from public.conversations;

-- 3) Remove the fake demo shops (sparkle/saigon/lotus) and leftover test shops
--    (cascades shop_services, shop_custom_services, shop_slot_overrides,
--    shop_photos, favorites, reviews, listing_claims).
delete from public.shops where id in (
  'sparkle',
  'saigon',
  'lotus',
  'chrio-s-dancing-studio-q758oc',
  'chrio-s-dancing-studio-75lm7b',
  'daniel-s-house-gagk7e',
  'kalent-s-very-big-car-wash-svh3h3'
);

-- 4) Rebrand the existing 22 An Phú partner shop to "Prisma" (keeps its id,
--    coordinates, opening hours and full bookable menu).
update public.shops set name = 'Prisma' where id = 'wurth-go';
