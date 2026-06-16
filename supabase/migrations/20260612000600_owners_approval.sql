-- 0006 SHOP OWNERS + APPROVAL — the marketplace side. Owners (role granted at
-- sign-up via handle_new_user) create and manage their own shops; customers
-- only ever see status='approved'; admins moderate.
--
-- Defense in depth = column grants + RLS together:
--   * column grants stop owners from EVER writing rating / reviews_count /
--     owner_id / status by hand (status moves via RPCs below / admin)
--   * RLS rows-scope everything to the shop they own

-- Column-level write protection on shops.
revoke insert, update on public.shops from authenticated;
grant insert (
  id, owner_id, name, district, address, phone, starting_price, wait_minutes,
  hours, is_open, promo, lat, lng, image_url, image_position
) on public.shops to authenticated;
grant update (
  name, district, address, phone, starting_price, wait_minutes,
  hours, is_open, promo, lat, lng, image_url, image_position
) on public.shops to authenticated;

-- Owners and admins can see non-approved shops (their drafts / the mod queue).
drop policy if exists "Owners can view their own shops" on public.shops;
create policy "Owners can view their own shops"
  on public.shops for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Admins can view all shops" on public.shops;
create policy "Admins can view all shops"
  on public.shops for select
  to authenticated
  using (public.is_admin());

-- Owners create their own shops. They cannot set status/rating (no column
-- grant) — new shops land in the default 'pending' state, invisible to
-- customers until approved.
drop policy if exists "Owners can create their own shops" on public.shops;
create policy "Owners can create their own shops"
  on public.shops for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.current_user_role() in ('owner', 'admin')
  );

drop policy if exists "Owners can update their own shops" on public.shops;
create policy "Owners can update their own shops"
  on public.shops for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can delete their own shops" on public.shops;
create policy "Owners can delete their own shops"
  on public.shops for delete
  to authenticated
  using (owner_id = (select auth.uid()) and status <> 'approved');

-- Admin moderation: service_role bypasses RLS, but admins work from the app
-- with their own JWT, so they need an explicit row policy. Column grants are
-- role-wide (can't differ per user), so admins edit the same columns as
-- owners; status transitions go through set_shop_status() below and rating /
-- reviews_count move only via the reviews trigger.
drop policy if exists "Admins manage all shops" on public.shops;
create policy "Admins manage all shops"
  on public.shops for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Status transitions live in a SECURITY DEFINER function so the rules are in
-- one audited place: owners may submit (draft→pending) or unpublish their own
-- shop; only admins approve or suspend.
create or replace function public.set_shop_status(p_shop_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop public.shops%rowtype;
  v_role text := public.current_user_role();
begin
  if p_status not in ('draft', 'pending', 'approved', 'suspended') then
    raise exception 'invalid status %', p_status;
  end if;
  select * into v_shop from public.shops where id = p_shop_id;
  if not found then
    raise exception 'shop % not found', p_shop_id;
  end if;

  if v_role = 'admin' then
    null; -- admins may set any status
  elsif v_shop.owner_id = (select auth.uid()) and p_status in ('draft', 'pending') then
    null; -- owners may save as draft or submit for review
  else
    raise exception 'not allowed';
  end if;

  update public.shops set status = p_status where id = p_shop_id;
end;
$$;

revoke execute on function public.set_shop_status(text, text) from public, anon;
grant execute on function public.set_shop_status(text, text) to authenticated;

-- Owners manage the services their shop offers (rows in the join table).
drop policy if exists "Owners manage their shop services" on public.shop_services;
create policy "Owners manage their shop services"
  on public.shop_services for all
  to authenticated
  using (
    exists (
      select 1 from public.shops s
      where s.id = shop_services.shop_id
        and (s.owner_id = (select auth.uid()) or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.shops s
      where s.id = shop_services.shop_id
        and (s.owner_id = (select auth.uid()) or public.is_admin())
    )
  );

-- Owners can also see the service catalog rows regardless of shop status
-- (services are already publicly readable). Admin-only writes on the global
-- catalogs (plans / services):
drop policy if exists "Admins manage plans" on public.plans;
create policy "Admins manage plans"
  on public.plans for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage services" on public.services;
create policy "Admins manage services"
  on public.services for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Shop photos: public-read bucket; an owner uploads under their shop's folder
-- (`<shop-id>/...`) and only for shops they actually own. Mirrors avatars.
insert into storage.buckets (id, name, public)
values ('shop-photos', 'shop-photos', true)
on conflict (id) do nothing;

drop policy if exists "Shop photos are publicly readable" on storage.objects;
create policy "Shop photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'shop-photos');

drop policy if exists "Owners can upload photos for their shops" on storage.objects;
create policy "Owners can upload photos for their shops"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'shop-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can update photos for their shops" on storage.objects;
create policy "Owners can update photos for their shops"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'shop-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can delete photos for their shops" on storage.objects;
create policy "Owners can delete photos for their shops"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'shop-photos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );
