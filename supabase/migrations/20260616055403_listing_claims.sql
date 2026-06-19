-- 0022 LISTING CLAIMS — verification-based onboarding for directory listings.
-- An owner whose car wash is already on the map as a 'directory' pin submits a
-- claim with the real details we need to verify: the services + pricing they
-- offer, their working hours, and a photo of the location. It stays a PENDING
-- claim — the public directory pin is left untouched — until an admin approves.
-- On approval the listing becomes a partner shop they own (unpublished), the
-- submitted details are applied, and only then can they release it publicly.
--
-- Replaces the lightweight chat-based claim flow from 0021.
drop function if exists public.claim_listing(text);
drop function if exists public.approve_listing_claim(text, uuid);

create table if not exists public.listing_claims (
  id          uuid primary key default gen_random_uuid(),
  shop_id     text not null references public.shops(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  services    jsonb not null default '[]'::jsonb,   -- [{ "name": text, "price": int }]
  open_time   time,
  close_time  time,
  hours       text,
  phone       text,
  photo_url   text,
  note        text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (shop_id, user_id)
);
create index if not exists listing_claims_status_idx on public.listing_claims(status);
create index if not exists listing_claims_user_idx on public.listing_claims(user_id);

alter table public.listing_claims enable row level security;

-- Claimant sees their own claims; admins see all. All writes go through the
-- SECURITY DEFINER RPCs below, so no INSERT/UPDATE/DELETE policy is granted.
drop policy if exists "Claimants and admins read claims" on public.listing_claims;
create policy "Claimants and admins read claims"
  on public.listing_claims for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Submit or resubmit a claim. Upserts the caller's claim for a directory listing
-- and flags the shop as claim-in-progress (claimed_by) for at-a-glance status.
create or replace function public.submit_listing_claim(
  p_shop_id   text,
  p_services  jsonb default '[]'::jsonb,
  p_open      time default null,
  p_close     time default null,
  p_hours     text default null,
  p_phone     text default null,
  p_photo_url text default null,
  p_note      text default null
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
    (shop_id, user_id, status, services, open_time, close_time, hours, phone, photo_url, note)
  values
    (p_shop_id, v_uid, 'pending', coalesce(p_services, '[]'::jsonb),
     p_open, p_close, p_hours, p_phone, p_photo_url, p_note)
  on conflict (shop_id, user_id) do update
    set status = 'pending',
        services = coalesce(excluded.services, '[]'::jsonb),
        open_time = excluded.open_time,
        close_time = excluded.close_time,
        hours = excluded.hours,
        phone = excluded.phone,
        photo_url = excluded.photo_url,
        note = excluded.note,
        created_at = now(),
        reviewed_at = null,
        reviewed_by = null
  returning id into v_id;

  update public.shops set claimed_by = v_uid
  where id = p_shop_id and (claimed_by is null or claimed_by = v_uid);

  return v_id;
end;
$$;
revoke execute on function public.submit_listing_claim(text, jsonb, time, time, text, text, text, text) from public, anon;
grant execute on function public.submit_listing_claim(text, jsonb, time, time, text, text, text, text) to authenticated;

-- Admin approves a claim: applies the submitted details to the shop, assigns
-- ownership, converts it to a partner listing (unpublished, awaiting the owner's
-- public release), promotes the claimant to owner, and rejects rival claims.
create or replace function public.approve_listing_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.listing_claims%rowtype;
  v_svc   jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into v_claim from public.listing_claims where id = p_claim_id;
  if not found then raise exception 'claim not found'; end if;
  if v_claim.status <> 'pending' then raise exception 'claim already decided'; end if;

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
  where id = v_claim.shop_id;

  -- Submitted services -> the shop's custom services (name + price in VND).
  for v_svc in select * from jsonb_array_elements(coalesce(v_claim.services, '[]'::jsonb)) loop
    if coalesce(trim(v_svc->>'name'), '') <> '' then
      insert into public.shop_custom_services (shop_id, name, price)
      values (v_claim.shop_id, v_svc->>'name', greatest(0, coalesce((v_svc->>'price')::integer, 0)));
    end if;
  end loop;

  update public.profiles
  set role = 'owner', owner_status = 'approved'
  where id = v_claim.user_id and role <> 'admin';

  update public.listing_claims
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_claim_id;

  -- Any other pending claims on the same shop lose out.
  update public.listing_claims
  set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
  where shop_id = v_claim.shop_id and id <> p_claim_id and status = 'pending';
end;
$$;
revoke execute on function public.approve_listing_claim(uuid) from public, anon;
grant execute on function public.approve_listing_claim(uuid) to authenticated;

-- Admin rejects a claim. Clears the shop's claim flag when no other pending
-- claim remains, leaving the public directory listing exactly as it was.
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

  update public.shops
  set claimed_by = null
  where id = v_claim.shop_id
    and not exists (
      select 1 from public.listing_claims
      where shop_id = v_claim.shop_id and status = 'pending' and id <> p_claim_id
    );
end;
$$;
revoke execute on function public.reject_listing_claim(uuid) from public, anon;
grant execute on function public.reject_listing_claim(uuid) to authenticated;

-- Claim photos: a public bucket where each user writes only their own folder
-- (<uid>/...), mirroring the avatars bucket. On approval the URL is copied to
-- the shop's image_url. No broad SELECT policy is added: a public bucket serves
-- object URLs at /object/public/<path> WITHOUT consulting storage.objects RLS,
-- so getPublicUrl() works, while omitting the policy avoids letting clients
-- enumerate every file (same rationale as migration 0010).
insert into storage.buckets (id, name, public)
values ('claim-photos', 'claim-photos', true)
on conflict (id) do nothing;

drop policy if exists "Claim photos are publicly readable" on storage.objects;

drop policy if exists "Users upload their own claim photos" on storage.objects;
create policy "Users upload their own claim photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'claim-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users update their own claim photos" on storage.objects;
create policy "Users update their own claim photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'claim-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
