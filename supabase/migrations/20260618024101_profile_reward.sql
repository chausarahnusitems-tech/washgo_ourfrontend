-- 0043 PROFILE-COMPLETION REWARD — grant a one-time free-wash voucher when the
-- user fills in their full personal + vehicle details (name, phone, car model,
-- plate). Validated and granted server-side so it can't be farmed by toggling
-- fields; a profiles flag makes it idempotent.

alter table public.profiles add column if not exists profile_reward_claimed boolean not null default false;

-- True once the profile has all the details the reward requires. Centralised so
-- the UI progress check and the grant agree. Model may live in car_model or the
-- vehicle jsonb; plate lives in the vehicle jsonb.
create or replace function public.profile_is_complete(p public.profiles)
returns boolean
language sql
immutable
as $$
  select coalesce(btrim(p.full_name), '') <> ''
     and coalesce(btrim(p.phone), '') <> ''
     and coalesce(btrim(coalesce(p.car_model, p.vehicle->>'model')), '') <> ''
     and coalesce(btrim(p.vehicle->>'plate'), '') <> '';
$$;

-- Claim the reward: re-validate completeness, and (once) grant a free-wash
-- voucher. Returns the new voucher/claim state for the client to sync.
create or replace function public.complete_profile_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_granted boolean := false;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;

  if not public.profile_is_complete(v_profile) then
    raise exception 'profile incomplete';
  end if;

  if not v_profile.profile_reward_claimed then
    update public.profiles
      set profile_reward_claimed = true,
          voucher = true
      where id = v_uid;
    v_granted := true;
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  return jsonb_build_object(
    'granted', v_granted,
    'profile_reward_claimed', v_profile.profile_reward_claimed,
    'voucher', v_profile.voucher,
    'stamps', v_profile.stamps
  );
end;
$$;

revoke execute on function public.complete_profile_reward() from public, anon;
grant  execute on function public.complete_profile_reward() to authenticated;
