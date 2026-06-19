-- 0046 PROMO VIDEO (paid add-on) — a shop can show a short (~5s) promo video on
-- its info card, but only while the paid feature is active. The owner uploads the
-- video URL (grantable column), and pays from their wallet via a SECURITY DEFINER
-- RPC that sets the gating date (NOT client-writable). Mirrors start_membership.

alter table public.shops add column if not exists promo_video_url text;
alter table public.shops add column if not exists video_feature_until date;

-- Owners may set the video URL (the gate column video_feature_until is RPC-only).
grant insert (promo_video_url) on public.shops to authenticated;
grant update (promo_video_url) on public.shops to authenticated;

-- Buy/extend the promo-video feature: charge a server-defined fee from the
-- owner's wallet and extend video_feature_until by a month.
create or replace function public.buy_shop_video_feature(p_shop_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_fee     integer := 199000;  -- monthly promo-video fee (server-defined)
  v_shop    public.shops%rowtype;
  v_profile public.profiles%rowtype;
  v_until   date;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_shop from public.shops where id = p_shop_id;
  if not found then raise exception 'shop not found'; end if;
  if not (v_shop.owner_id = v_uid or public.is_admin()) then
    raise exception 'not allowed';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;
  if v_profile.funds < v_fee then raise exception 'insufficient funds'; end if;

  v_until := (greatest(current_date, coalesce(v_shop.video_feature_until, current_date)) + interval '1 month')::date;

  insert into public.wallet_transactions (user_id, amount, kind, note)
  values (v_uid, -v_fee, 'charge', 'Promo video feature');

  update public.profiles set funds = funds - v_fee where id = v_uid;
  update public.shops set video_feature_until = v_until where id = p_shop_id;

  select * into v_profile from public.profiles where id = v_uid;
  return jsonb_build_object('funds', v_profile.funds, 'video_feature_until', v_until);
end;
$$;

revoke execute on function public.buy_shop_video_feature(text) from public, anon;
grant  execute on function public.buy_shop_video_feature(text) to authenticated;

-- Public storage bucket for promo videos; owners write under '<shopId>/...'.
insert into storage.buckets (id, name, public)
values ('shop-videos', 'shop-videos', true)
on conflict (id) do nothing;

drop policy if exists "Shop videos are publicly readable" on storage.objects;
create policy "Shop videos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'shop-videos');

drop policy if exists "Owners can upload videos for their shops" on storage.objects;
create policy "Owners can upload videos for their shops"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'shop-videos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can update videos for their shops" on storage.objects;
create policy "Owners can update videos for their shops"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'shop-videos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can delete videos for their shops" on storage.objects;
create policy "Owners can delete videos for their shops"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'shop-videos'
    and exists (
      select 1 from public.shops s
      where s.id = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );
