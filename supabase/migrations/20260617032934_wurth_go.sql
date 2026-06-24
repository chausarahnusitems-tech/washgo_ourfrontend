-- 0025 WÜRTH GO — add the Würth Go car-care store as a map listing with its full
-- WÜRTH-technology service menu (the price list this project's service options
-- are modelled on). Seeded as a 'directory' listing (info-only, like the other
-- imported stores) at the geocoded An Khánh / Thủ Đức address. The service menu
-- is stored structurally in shop_custom_services, with a short summary in notes.
insert into public.shops
  (id, owner_id, name, district, address, phone, rating, reviews_count, hours,
   lat, lng, is_open, status, published, listing_type, notes, starting_price)
values
  ('wurth-go', null, 'Würth Go', 'Thủ Đức (Q2)', '22 An Phú, An Khánh, Hồ Chí Minh, Vietnam',
   null, 0, 0, 'Daily 8AM-6PM', 10.8061388, 106.7522256, true, 'approved', true, 'directory',
   'Official WÜRTH-technology car care. Packages: German-Standard Wash 150.000₫ · Advanced 250.000₫ · Premium 650.000₫ · Comprehensive 1.800.000₫. Also detailing, ceramic coating, paint correction, underbody coating & soundproofing.',
   null)
on conflict (id) do nothing;

-- Full WÜRTH service menu (packages + optional services), prices in VND.
insert into public.shop_custom_services (shop_id, name, price)
select 'wurth-go', s.name, s.price
from (values
  ('German-Standard Car Wash (WÜRTH Technology)', 150000),
  ('Advanced Service Package', 250000),
  ('Premium Service Package', 650000),
  ('Comprehensive Cleaning', 1800000),
  ('Interior deodorization', 150000),
  ('Plastic/rubber maintenance', 350000),
  ('Glass paint overspray removal', 400000),
  ('Leather/fabric maintenance', 350000),
  ('Paint surface cleaning', 500000),
  ('Paint surface maintenance', 500000),
  ('Air conditioner deodorization', 500000),
  ('Glass polishing', 1400000),
  ('Paint polishing', 1500000),
  ('Underbody coating', 3500000),
  ('Soundproofing', 12500000)
) as s(name, price)
where exists (select 1 from public.shops where id = 'wurth-go')
  and not exists (
    select 1 from public.shop_custom_services c
    where c.shop_id = 'wurth-go' and c.name = s.name
  );
