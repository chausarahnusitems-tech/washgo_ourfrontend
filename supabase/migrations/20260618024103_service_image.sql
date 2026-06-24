-- 0044 SERVICE IMAGE — let owners attach a photo to each custom service. Owners
-- already have full RLS write on shop_custom_services (0014), so this is just a
-- column. Images live in the existing public 'shop-photos' bucket under
-- '<shopId>/services/...', already covered by that bucket's owner-by-shop RLS.

alter table public.shop_custom_services add column if not exists image_url text;
