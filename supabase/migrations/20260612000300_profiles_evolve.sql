-- 0003 PROFILES EVOLUTION — brings profiles up to what the frontend actually
-- uses today (VND wallet, language, pending voucher) and adds the role model
-- for the two-sided marketplace (customer / owner / admin).
--
-- `tokens` is intentionally KEPT for now: the running app still writes it.
-- It gets dropped when the frontend is wired to the new wallet.

alter table public.profiles
  add column if not exists funds integer not null default 0;
alter table public.profiles
  add column if not exists role text not null default 'customer';
alter table public.profiles
  add column if not exists lang text not null default 'en';
alter table public.profiles
  add column if not exists pending_voucher boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_funds_check') then
    alter table public.profiles
      add constraint profiles_funds_check check (funds >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('customer', 'owner', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_lang_check') then
    alter table public.profiles
      add constraint profiles_lang_check check (lang in ('en', 'vi'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_stamps_check') then
    alter table public.profiles
      add constraint profiles_stamps_check check (stamps between 0 and 5);
  end if;
  -- selected_plan now references the seeded plans table.
  if not exists (select 1 from pg_constraint where conname = 'profiles_selected_plan_fkey') then
    alter table public.profiles
      add constraint profiles_selected_plan_fkey
      foreign key (selected_plan) references public.plans (id);
  end if;
end;
$$;

-- Role helpers for RLS policies. SECURITY DEFINER so policies on OTHER tables
-- can read profiles.role without recursing into profiles' own RLS. STABLE so
-- the planner caches the result per statement.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Owner onboarding ("another way to sign up"): the dedicated owner sign-up
-- passes `signup_role: 'owner'` in the auth metadata; the trigger maps it to
-- the owner role server-side. Self-declared 'admin' is impossible — anything
-- other than 'owner' becomes 'customer'. Admins are promoted manually.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    case when new.raw_user_meta_data ->> 'signup_role' = 'owner'
         then 'owner' else 'customer' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Column-level write protection: role and funds must never be set directly by
-- clients (role changes are admin/manual; funds move only through the wallet
-- RPCs). Everything else the app edits today stays writable so the current
-- frontend keeps working untouched.
-- NOTE: tokens/stamps/voucher/pending_voucher/selected_plan/vehicle remain
-- client-writable ON PURPOSE for now — AppContext persists them directly.
-- Once the frontend moves to the booking/wallet RPCs, revoke those too.
revoke update on public.profiles from authenticated;
grant update (
  full_name, avatar_url, phone, car_model, lang,
  tokens, stamps, voucher, pending_voucher, selected_plan, vehicle
) on public.profiles to authenticated;
