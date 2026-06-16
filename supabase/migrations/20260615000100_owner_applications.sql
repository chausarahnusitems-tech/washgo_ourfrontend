-- 0013 OWNER APPLICATIONS — customers apply to run a car wash from their profile;
-- an admin reviews and approves. owner_status tracks the lifecycle; the role
-- only flips to 'owner' on approval. Not in the profiles UPDATE grant, so clients
-- can't self-set it — these SECURITY DEFINER RPCs are the only writers.
alter table public.profiles
  add column if not exists owner_status text not null default 'none';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_owner_status_check') then
    alter table public.profiles
      add constraint profiles_owner_status_check
      check (owner_status in ('none', 'pending', 'approved', 'rejected'));
  end if;
end;
$$;

-- A signed-in customer applies. No role change yet. Idempotent: only moves a
-- fresh/rejected application to pending (an approved owner stays approved).
create or replace function public.apply_for_owner()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set owner_status = 'pending'
    where id = (select auth.uid())
      and owner_status in ('none', 'rejected');
end;
$$;

revoke execute on function public.apply_for_owner() from public, anon;
grant execute on function public.apply_for_owner() to authenticated;

-- Admin decision. Approving grants the owner role; rejecting/clearing an owner
-- drops them back to customer.
create or replace function public.set_owner_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if p_status not in ('none', 'pending', 'approved', 'rejected') then
    raise exception 'invalid owner status %', p_status;
  end if;
  update public.profiles
    set owner_status = p_status,
        role = case
                 when p_status = 'approved' then 'owner'
                 when p_status in ('rejected', 'none') and role = 'owner' then 'customer'
                 else role
               end
    where id = p_user_id;
end;
$$;

revoke execute on function public.set_owner_status(uuid, text) from public, anon;
grant execute on function public.set_owner_status(uuid, text) to authenticated;
