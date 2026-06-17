-- 0027 WÜRTH GO BOOKABLE MENU — make the full WÜRTH service list individually
-- bookable by promoting it into the shared service catalogue and attaching it to
-- Würth Go (replacing the 4 generic placeholders). The booking screen shows each
-- shop only its own attached services, so other shops aren't affected.
insert into public.services (id, name, price, icon) values
  ('wgoGermanStandard', 'German-Standard Car Wash (WÜRTH)', 150000, 'Car'),
  ('wgoAdvanced',       'Advanced Service Package',          250000, 'Sparkles'),
  ('wgoPremium',        'Premium Service Package',           650000, 'Sparkles'),
  ('wgoComprehensive',  'Comprehensive Cleaning',           1800000, 'ShieldCheck'),
  ('wgoInteriorDeodor', 'Interior Deodorization',            150000, 'Armchair'),
  ('wgoPlasticCare',    'Plastic/Rubber Maintenance',        350000, 'ShieldCheck'),
  ('wgoOverspray',      'Glass Paint Overspray Removal',     400000, 'Droplets'),
  ('wgoLeatherCare',    'Leather/Fabric Maintenance',        350000, 'Armchair'),
  ('wgoPaintClean',     'Paint Surface Cleaning',            500000, 'Droplets'),
  ('wgoPaintMaintain',  'Paint Surface Maintenance',         500000, 'ShieldCheck'),
  ('wgoAcDeodor',       'Air Conditioner Deodorization',     500000, 'Droplets'),
  ('wgoGlassPolish',    'Glass Polishing',                  1400000, 'Sparkles'),
  ('wgoPaintPolish',    'Paint Polishing',                  1500000, 'Sparkles'),
  ('wgoUnderbody',      'Underbody Coating',                3500000, 'ShieldCheck'),
  ('wgoSoundproof',     'Soundproofing',                   12500000, 'Zap')
on conflict (id) do nothing;

-- Replace Würth Go's generic placeholder services with its real WÜRTH menu.
delete from public.shop_services where shop_id = 'wurth-go';
insert into public.shop_services (shop_id, service_id)
select 'wurth-go', id from public.services where id like 'wgo%'
on conflict do nothing;

-- The custom-service copies are now redundant (they're catalogue services).
delete from public.shop_custom_services where shop_id = 'wurth-go';

update public.shops set starting_price = 150000 where id = 'wurth-go';
