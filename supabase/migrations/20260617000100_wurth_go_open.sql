-- 0026 WÜRTH GO OPEN FOR BUSINESS — promote the Würth Go directory listing to a
-- live, bookable partner shop: a real starting price, daily hours, per-slot
-- capacity, and the standard bookable services (the booking flow uses the shared
-- service catalogue). The full WÜRTH menu stays as the shop's custom services +
-- the notes summary shown on its detail card.
update public.shops
set listing_type      = 'partner',
    starting_price    = 150000,
    open_time         = '08:00',
    close_time        = '18:00',
    slot_minutes      = 60,
    max_cars_per_slot = 3,
    is_open           = true
where id = 'wurth-go';

-- Attach the standard catalogue services so it has bookable services + chips.
insert into public.shop_services (shop_id, service_id)
select 'wurth-go', s.id from public.services s
on conflict (shop_id, service_id) do nothing;
