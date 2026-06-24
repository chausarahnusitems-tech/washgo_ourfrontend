-- 0017 MEMBERSHIP — collapse to one paid monthly tier. Membership = the premium
-- plan (10% off, via the existing plans.discount_percent plumbing) plus a
-- renewal date. Non-members are 'basic' (no discount). Simulated subscription:
-- no real recurring billing.

alter table public.profiles add column if not exists membership_until date;

-- Membership is now opt-in & paid: reset everyone to non-member basic.
update public.profiles set selected_plan = 'basic', membership_until = null;
alter table public.profiles alter column selected_plan set default 'basic';

-- Join/renew: charge the (server-defined) fee from the wallet, set premium +
-- extend the renewal date by a month.
create or replace function public.start_membership()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_fee     integer := 199000;  -- monthly membership fee (server-defined, not trusted from client)
  v_profile public.profiles%rowtype;
  v_until   date;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;
  if v_profile.funds < v_fee then raise exception 'insufficient funds'; end if;

  v_until := (greatest(current_date, coalesce(v_profile.membership_until, current_date)) + interval '1 month')::date;

  insert into public.wallet_transactions (user_id, amount, kind, note)
  values (v_uid, -v_fee, 'charge', 'Membership');

  update public.profiles
    set funds = funds - v_fee,
        selected_plan = 'premium',
        membership_until = v_until
    where id = v_uid;

  select * into v_profile from public.profiles where id = v_uid;
  return jsonb_build_object('funds', v_profile.funds, 'membership_until', v_profile.membership_until);
end;
$$;

revoke execute on function public.start_membership() from public, anon;
grant execute on function public.start_membership() to authenticated;

-- Coupons (basic): readable perk list surfaced to members.
create table if not exists public.coupons (
  code        text primary key,
  description text,
  percent     integer not null check (percent between 0 and 100),
  expires_at  date
);
alter table public.coupons enable row level security;
drop policy if exists "Coupons are readable" on public.coupons;
create policy "Coupons are readable" on public.coupons for select using (true);

insert into public.coupons (code, description, percent, expires_at) values
  ('SEASON15', 'Seasonal 15% off any wash', 15, current_date + 90),
  ('SHINE10', 'Member bonus 10% off detailing', 10, current_date + 60)
on conflict (code) do nothing;
