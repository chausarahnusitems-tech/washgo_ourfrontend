-- 0023 LISTING APPLICATIONS — unify owner onboarding into one application flow
-- with two entry points, both ending in admin approval before the owner can
-- publicly release the shop:
--   (1) NEW shop that isn't on the map yet (claim.shop_id is null; the shop is
--       created on approval), and
--   (2) CLAIM an existing directory listing (claim.shop_id set).
-- Submitting either also registers the user as a pending owner applicant
-- (owner_status='pending'); approval grants the owner role. Claims also carry
-- closed dates (applied as shop_slot_overrides) and richer details.

-- Make claims able to describe a brand-new shop, not just reference one.
alter table public.listing_claims alter column shop_id drop not null;
alter table public.listing_claims add column if not exists name text;
alter table public.listing_claims add column if not exists address text;
alter table public.listing_claims add column if not exists district text;
alter table public.listing_claims add column if not exists lat double precision;
alter table public.listing_claims add column if not exists lng double precision;
alter table public.listing_claims add column if not exists closed_dates jsonb not null default '[]'::jsonb;

-- ---- Submit: claim an existing directory listing ---------------------------
drop function if exists public.submit_listing_claim(text, jsonb, time, time, text, text, text, text);

create or replace function public.submit_listing_claim(
  p_shop_id      text,
  p_services     jsonb default '[]'::jsonb,
  p_open         time default null,
  p_close        time default null,
  p_hours        text default null,
  p_phone        text default null,
  p_photo_url    text default null,
  p_note         text default null,
  p_closed_dates jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.shops where id = p_shop_id and listing_type = 'directory') then
    raise exception 'not a claimable directory listing';
  end if;

  insert into public.listing_claims
    (shop_id, user_id, status, services, open_time, close_time, hours, phone, photo_url, note, closed_dates)
  values
    (p_shop_id, v_uid, 'pending', coalesce(p_services, '[]'::jsonb),
     p_open, p_close, p_hours, p_phone, p_photo_url, p_note, coalesce(p_closed_dates, '[]'::jsonb))
  on conflict (shop_id, user_id) do update
    set status = 'pending',
        services = coalesce(excluded.services, '[]'::jsonb),
        open_time = excluded.open_time,
        close_time = excluded.close_time,
        hours = excluded.hours,
        phone = excluded.phone,
        photo_url = excluded.photo_url,
        note = excluded.note,
        closed_dates = coalesce(excluded.closed_dates, '[]'::jsonb),
        created_at = now(),
        reviewed_at = null,
        reviewed_by = null
  returning id into v_id;

  update public.shops set claimed_by = v_uid
  where id = p_shop_id and (claimed_by is null or claimed_by = v_uid);

  -- Applying also applies for an owner account.
  update public.profiles set owner_status = 'pending'
  where id = v_uid and role not in ('owner', 'admin');

  return v_id;
end;
$$;
revoke execute on function public.submit_listing_claim(text, jsonb, time, time, text, text, text, text, jsonb) from public, anon;
grant execute on function public.submit_listing_claim(text, jsonb, time, time, text, text, text, text, jsonb) to authenticated;

-- ---- Submit: apply for a brand-new shop ------------------------------------
create or replace function public.submit_new_listing(
  p_name         text,
  p_address      text default null,
  p_district     text default null,
  p_lat          double precision default null,
  p_lng          double precision default null,
  p_services     jsonb default '[]'::jsonb,
  p_open         time default null,
  p_close        time default null,
  p_hours        text default null,
  p_phone        text default null,
  p_photo_url    text default null,
  p_note         text default null,
  p_closed_dates jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name required'; end if;

  insert into public.listing_claims
    (shop_id, user_id, status, name, address, district, lat, lng,
     services, open_time, close_time, hours, phone, photo_url, note, closed_dates)
  values
    (null, v_uid, 'pending', trim(p_name), p_address, p_district, p_lat, p_lng,
     coalesce(p_services, '[]'::jsonb), p_open, p_close, p_hours, p_phone, p_photo_url, p_note,
     coalesce(p_closed_dates, '[]'::jsonb))
  returning id into v_id;

  update public.profiles set owner_status = 'pending'
  where id = v_uid and role not in ('owner', 'admin');

  return v_id;
end;
$$;
revoke execute on function public.submit_new_listing(text, text, text, double precision, double precision, jsonb, time, time, text, text, text, text, jsonb) from public, anon;
grant execute on function public.submit_new_listing(text, text, text, double precision, double precision, jsonb, time, time, text, text, text, text, jsonb) to authenticated;

-- ---- Approve: works for both a claimed listing and a brand-new shop --------
create or replace function public.approve_listing_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.listing_claims%rowtype;
  v_svc   jsonb;
  v_date  text;
  v_shop  text;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into v_claim from public.listing_claims where id = p_claim_id;
  if not found then raise exception 'claim not found'; end if;
  if v_claim.status <> 'pending' then raise exception 'claim already decided'; end if;

  if v_claim.shop_id is not null then
    -- Claim of an existing directory listing -> convert to an owned partner shop.
    v_shop := v_claim.shop_id;
    update public.shops
    set owner_id = v_claim.user_id,
        listing_type = 'partner',
        status = 'approved',
        published = false,
        claimed_by = null,
        open_time = coalesce(v_claim.open_time, open_time),
        close_time = coalesce(v_claim.close_time, close_time),
        hours = coalesce(v_claim.hours, hours),
        phone = coalesce(v_claim.phone, phone),
        image_url = coalesce(v_claim.photo_url, image_url)
    where id = v_shop;
  else
    -- Brand-new shop -> create it (approved but unpublished, owner releases it).
    v_shop := left(regexp_replace(lower(coalesce(v_claim.name, 'shop')), '[^a-z0-9]+', '-', 'g'), 40);
    v_shop := trim(both '-' from v_shop);
    if v_shop = '' then v_shop := 'shop'; end if;
    v_shop := v_shop || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

    insert into public.shops
      (id, owner_id, name, district, address, phone, hours, lat, lng,
       open_time, close_time, image_url, is_open, status, published, listing_type)
    values
      (v_shop, v_claim.user_id, coalesce(v_claim.name, 'New shop'), v_claim.district, v_claim.address,
       v_claim.phone, v_claim.hours, v_claim.lat, v_claim.lng,
       v_claim.open_time, v_claim.close_time, v_claim.photo_url, true, 'approved', false, 'partner');
  end if;

  -- Submitted services -> the shop's custom services (name + price in VND).
  for v_svc in select * from jsonb_array_elements(coalesce(v_claim.services, '[]'::jsonb)) loop
    if coalesce(trim(v_svc->>'name'), '') <> '' then
      insert into public.shop_custom_services (shop_id, name, price)
      values (v_shop, v_svc->>'name', greatest(0, coalesce((v_svc->>'price')::integer, 0)));
    end if;
  end loop;

  -- Closed dates -> special-day overrides (closed).
  for v_date in select jsonb_array_elements_text(coalesce(v_claim.closed_dates, '[]'::jsonb)) loop
    begin
      insert into public.shop_slot_overrides (shop_id, date, is_closed)
      values (v_shop, v_date::date, true)
      on conflict (shop_id, date) do update set is_closed = true;
    exception when others then
      null; -- skip unparseable dates
    end;
  end loop;

  -- Grant the owner account.
  update public.profiles
  set role = 'owner', owner_status = 'approved'
  where id = v_claim.user_id and role <> 'admin';

  update public.listing_claims
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_claim_id;

  -- Rival claims on the same existing listing lose out.
  if v_claim.shop_id is not null then
    update public.listing_claims
    set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
    where shop_id = v_claim.shop_id and id <> p_claim_id and status = 'pending';
  end if;
end;
$$;
revoke execute on function public.approve_listing_claim(uuid) from public, anon;
grant execute on function public.approve_listing_claim(uuid) to authenticated;

-- ---- Reject: leave the directory listing as-is; reset the owner application -
create or replace function public.reject_listing_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.listing_claims%rowtype;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into v_claim from public.listing_claims where id = p_claim_id;
  if not found then raise exception 'claim not found'; end if;

  update public.listing_claims
  set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_claim_id;

  if v_claim.shop_id is not null then
    update public.shops
    set claimed_by = null
    where id = v_claim.shop_id
      and not exists (
        select 1 from public.listing_claims
        where shop_id = v_claim.shop_id and status = 'pending' and id <> p_claim_id
      );
  end if;

  -- Reset the bundled owner application unless they're already an owner or have
  -- another claim still pending.
  update public.profiles
  set owner_status = 'none'
  where id = v_claim.user_id
    and role = 'customer'
    and not exists (
      select 1 from public.listing_claims
      where user_id = v_claim.user_id and status = 'pending' and id <> p_claim_id
    );
end;
$$;
revoke execute on function public.reject_listing_claim(uuid) from public, anon;
grant execute on function public.reject_listing_claim(uuid) to authenticated;
