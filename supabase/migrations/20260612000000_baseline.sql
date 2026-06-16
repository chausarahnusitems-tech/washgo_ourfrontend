-- 0000 BASELINE — captures what was previously applied by hand via the SQL
-- editor (docs/supabase-auth.sql) so the repo becomes the source of truth.
-- Everything is idempotent: replaying against the live DB (which already has
-- profiles + trigger + avatars bucket) is a no-op apart from policy refreshes.

-- 1. Profiles, keyed 1:1 to Supabase's managed auth.users.
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  full_name     text,
  avatar_url    text,
  tokens        integer not null default 100,
  stamps        integer not null default 0,
  voucher       boolean not null default false,
  selected_plan text    not null default 'premium',
  vehicle       jsonb   not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists car_model text;

-- 2. Row Level Security: a user can only see / change their own row.
-- (Inserts happen via the handle_new_user trigger, not from clients.)
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by their owner" on public.profiles;
create policy "Profiles are viewable by their owner"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 3. Auto-create a profile when a new auth user signs up. Pulls name/avatar
--    from the Google identity payload when present. (Extended in a later
--    migration to also stamp the account role.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Avatar storage: public bucket; signed-in users manage only their own
--    folder (objects stored under `<user-id>/...`).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
