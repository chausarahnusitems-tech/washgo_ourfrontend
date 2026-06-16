-- 0001 EXTENSIONS + SHARED HELPERS

-- earthdistance (and its dependency cube) powers the nearby_shops() distance
-- function without pulling in full PostGIS.
create extension if not exists cube with schema extensions;
create extension if not exists earthdistance with schema extensions;

-- Shared updated_at maintenance for every table that carries the column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
