-- Washgo auth schema. Run in Supabase dashboard → SQL Editor.
-- Creates a `profiles` row per user and mirrors the app's per-user state
-- (tokens / stamps / voucher / plan / vehicle) so it persists across devices.

-- 1. Profiles table, keyed 1:1 to Supabase's managed auth.users.
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

-- 1b. Extra profile fields (run on an existing project to add them).
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists car_model text;

-- 2. Row Level Security: a user can only see / change their own row.
alter table public.profiles enable row level security;

create policy "Profiles are viewable by their owner"
  on=- public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 3. Auto-create a profile when a new auth user signs up. Pulls name/avatar
--    from the Google identity payload when present.
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

-- 4. Avatar storage. Public bucket so profile pictures load via getPublicUrl,
--    with policies that let a signed-in user manage only their own folder
--    (objects are stored under `<user-id>/...`).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
