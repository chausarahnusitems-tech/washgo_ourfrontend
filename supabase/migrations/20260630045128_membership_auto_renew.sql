-- 0063 MEMBERSHIP AUTO-RENEWAL — turn the simulated monthly membership into an
-- automatic wallet-charged renewal that's manually cancellable, with a top-up
-- grace window and queued email notifications.
--
-- Behaviour (driven by the daily process_membership_renewals() cron job):
--   * On/after membership_until with auto-renew ON:
--       - funds >= fee -> charge wallet, extend membership_until +1 month (clears grace)
--       - funds <  fee -> first time: queue a 'topup_reminder' email + open a
--                         GRACE_DAYS window; while still short within the window: wait;
--                         once the window passes still short -> cancel (drop to basic)
--                         + queue a 'membership_cancelled' email
--   * On/after membership_until with auto-renew OFF (user cancelled):
--       - quietly lapse to basic at expiry (they opted out; no email)
--
-- Emails are written to public.membership_email_outbox (auditable). Actual
-- delivery is handled later by dispatch_membership_emails() once a provider
-- (Resend/SMTP) is wired in — nothing here makes outbound HTTP calls.

-- 1) Schema: auto-renew flag (default on) + grace marker.
alter table public.profiles
  add column if not exists membership_auto_renew boolean not null default true;
alter table public.profiles
  add column if not exists membership_grace_until date;

-- 2) Email outbox (internal). RLS on with NO policy means ordinary users can
-- neither read nor write it; only the service role (bypasses RLS) and the
-- security-definer functions below touch it.
create table if not exists public.membership_email_outbox (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  email      text not null,
  kind       text not null check (kind in ('topup_reminder', 'membership_cancelled')),
  subject    text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  error      text
);
alter table public.membership_email_outbox enable row level security;
create index if not exists membership_email_outbox_unsent_idx
  on public.membership_email_outbox (created_at)
  where sent_at is null;

-- 3) Manual cancel/resume: flip the auto-renew flag for the calling user. Cancel
-- = set false (keeps perks until membership_until, then it lapses); resume = true.
create or replace function public.set_membership_auto_renew(p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  update public.profiles
    set membership_auto_renew = coalesce(p_on, true)
    where id = v_uid
    returning * into v_profile;
  if not found then raise exception 'profile missing'; end if;
  return jsonb_build_object(
    'membership_auto_renew', v_profile.membership_auto_renew,
    'membership_until', v_profile.membership_until,
    'selected_plan', v_profile.selected_plan
  );
end;
$$;
revoke execute on function public.set_membership_auto_renew(boolean) from public, anon;
grant execute on function public.set_membership_auto_renew(boolean) to authenticated;

-- 4) Joining / manually renewing re-arms auto-renew and clears any grace state.
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
        membership_until = v_until,
        membership_auto_renew = true,
        membership_grace_until = null
    where id = v_uid;

  select * into v_profile from public.profiles where id = v_uid;
  return jsonb_build_object(
    'funds', v_profile.funds,
    'membership_until', v_profile.membership_until,
    'membership_auto_renew', v_profile.membership_auto_renew
  );
end;
$$;
revoke execute on function public.start_membership() from public, anon;
grant execute on function public.start_membership() to authenticated;

-- 5) Daily sweep: auto-renew, open grace + remind, or cancel each due membership.
-- Runs from pg_cron as the table owner; kept off the client entirely.
create or replace function public.process_membership_renewals()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee        integer := 199000;
  v_grace_days integer := 3;
  v_renewed    integer := 0;
  v_reminded   integer := 0;
  v_cancelled  integer := 0;
  v_lapsed     integer := 0;
  r            record;
  v_email      text;
  v_until      date;
begin
  -- Every premium member whose paid period has reached its end.
  for r in
    select * from public.profiles
    where selected_plan = 'premium'
      and membership_until is not null
      and membership_until <= current_date
    for update
  loop
    select email into v_email from auth.users where id = r.id;

    if not r.membership_auto_renew then
      -- User cancelled auto-renew: lapse quietly to basic at expiry.
      update public.profiles
        set selected_plan = 'basic',
            membership_until = null,
            membership_grace_until = null
        where id = r.id;
      v_lapsed := v_lapsed + 1;
      continue;
    end if;

    if r.funds >= v_fee then
      -- Auto-renew: charge the wallet and extend a month (also recovers from grace).
      v_until := (greatest(current_date, r.membership_until) + interval '1 month')::date;
      insert into public.wallet_transactions (user_id, amount, kind, note)
      values (r.id, -v_fee, 'charge', 'Membership auto-renewal');
      update public.profiles
        set funds = funds - v_fee,
            membership_until = v_until,
            membership_grace_until = null
        where id = r.id;
      v_renewed := v_renewed + 1;
      continue;
    end if;

    -- Insufficient funds.
    if r.membership_grace_until is null then
      -- First shortfall: open a grace window and ask them to top up.
      update public.profiles
        set membership_grace_until = current_date + v_grace_days
        where id = r.id;
      if v_email is not null then
        insert into public.membership_email_outbox (user_id, email, kind, subject, body)
        values (
          r.id, v_email, 'topup_reminder',
          'Action needed: top up to keep your WASHGO membership',
          'Hi,' || chr(10) || chr(10) ||
          'We couldn''t renew your WASHGO membership because your wallet balance ' ||
          'is below the monthly fee of 199,000d. Please top up your wallet by ' ||
          to_char(current_date + v_grace_days, 'FMDay, DD Mon YYYY') ||
          ' to keep your membership and 10% member discount active.' || chr(10) || chr(10) ||
          'If you don''t top up in time, your membership will be cancelled automatically.' ||
          chr(10) || chr(10) || 'Thanks,' || chr(10) || 'The WASHGO team'
        );
        v_reminded := v_reminded + 1;
      end if;
    elsif current_date > r.membership_grace_until then
      -- Grace elapsed without a top-up: cancel the membership. Strict '>' so the
      -- member keeps the full deadline day quoted in the reminder email before
      -- the next sweep cancels them (the day after).
      update public.profiles
        set selected_plan = 'basic',
            membership_until = null,
            membership_grace_until = null
        where id = r.id;
      if v_email is not null then
        insert into public.membership_email_outbox (user_id, email, kind, subject, body)
        values (
          r.id, v_email, 'membership_cancelled',
          'Your WASHGO membership has been cancelled',
          'Hi,' || chr(10) || chr(10) ||
          'Your WASHGO membership has been cancelled because your wallet didn''t ' ||
          'have enough balance to cover this month''s fee in time.' || chr(10) || chr(10) ||
          'You can re-join anytime from the Membership page once you''ve topped up ' ||
          'your wallet — your perks will resume immediately.' || chr(10) || chr(10) ||
          'Thanks,' || chr(10) || 'The WASHGO team'
        );
        v_cancelled := v_cancelled + 1;
      end if;
    end if;
    -- else: still within grace, reminder already sent — wait for them to top up.
  end loop;

  return jsonb_build_object(
    'renewed', v_renewed,
    'reminded', v_reminded,
    'cancelled', v_cancelled,
    'lapsed', v_lapsed,
    'ran_at', now()
  );
end;
$$;
revoke execute on function public.process_membership_renewals() from public, anon, authenticated;

-- 6) Email delivery hook (stub). The outbox above captures every notification;
-- this is the single place to wire a provider (Resend/SMTP via pg_net or an edge
-- function) later. Until then it's a no-op reporter, so queued rows are preserved
-- (nothing is lost). When wiring delivery: for each unsent row, send it, then
--   update public.membership_email_outbox set sent_at = now() where id = <row id>;
-- (or set `error` on failure so the next run retries it).
create or replace function public.dispatch_membership_emails()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending integer;
begin
  select count(*) into v_pending
  from public.membership_email_outbox
  where sent_at is null;
  -- TODO(provider): deliver each unsent row and stamp sent_at / error.
  return jsonb_build_object('pending', v_pending, 'delivered', 0);
end;
$$;
revoke execute on function public.dispatch_membership_emails() from public, anon, authenticated;

-- 7) Schedule the daily sweep (re-schedulable, mirroring expire-missed-bookings).
create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule('process-membership-renewals');
exception when others then
  null; -- not scheduled yet
end;
$$;
select cron.schedule('process-membership-renewals', '17 1 * * *', $job$ select public.process_membership_renewals(); $job$);

notify pgrst, 'reload schema';
