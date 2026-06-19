-- 0051 PAYOS BILLING — real money enters through the PayOS gateway (VietQR /
-- bank transfer / e-wallets). The gateway only ever does ONE-TIME payments; the
-- wallet stays the app's internal currency, so bookings and WashGo+ membership
-- keep paying from the wallet exactly as before.
--
-- The truth comes from the webhook, never the browser:
--   * topup   payment  -> settle_topup()           credits the wallet
--   * booking payment  -> settle_booking_payment() flips pending_payment -> upcoming
--
-- SECURITY: top_up() was granted to `authenticated` (fine while top-ups were
-- fake). Now that real money backs the wallet, a client must NOT be able to mint
-- funds — top_up() is revoked and replaced by service-role-only settlement RPCs,
-- which only the webhook (service role) can call.

-- ---------------------------------------------------------------------------
-- Numeric order code — PayOS requires a unique *number* per payment link; our
-- rows are uuids, so a dedicated sequence supplies the gateway's orderCode.
create sequence if not exists public.payos_order_code_seq start with 100000;

-- ---------------------------------------------------------------------------
-- payments — one row per gateway payment attempt (audit + reconciliation). Like
-- wallet_transactions: clients may READ their own rows; ALL writes go through the
-- service role (the /api/checkout/session route and the webhook), so a client can
-- never forge a "paid" row.
create table if not exists public.payments (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  kind                 text not null check (kind in ('topup', 'booking')),
  booking_id           uuid references public.bookings (id) on delete set null,
  provider             text not null default 'payos',
  order_code           bigint not null unique default nextval('public.payos_order_code_seq'),
  payos_payment_link_id text,
  checkout_url         text,
  amount               integer not null check (amount > 0), -- VND (zero-decimal)
  currency             text not null default 'vnd',
  status               text not null default 'created'
                         check (status in ('created', 'paid', 'failed', 'cancelled', 'expired')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter sequence public.payos_order_code_seq owned by public.payments.order_code;
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
create index if not exists payments_booking_idx on public.payments (booking_id);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;
drop policy if exists "Users can view their own payments" on public.payments;
create policy "Users can view their own payments"
  on public.payments for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- payment_events — webhook idempotency. Internal only: RLS on with NO policies,
-- so authenticated/anon can't read it; the service role bypasses RLS.
create table if not exists public.payment_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null default 'payos',
  event_id     text not null,
  type         text,
  payload      jsonb,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);
alter table public.payment_events enable row level security;

-- ---------------------------------------------------------------------------
-- reward_ledger — append-only audit of every loyalty-stamp movement. The
-- authoritative count the UI reads stays profiles.stamps; this is the safety log
-- that lets us reconstruct/verify it later.
create table if not exists public.reward_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  booking_id  uuid references public.bookings (id) on delete set null,
  payment_id  uuid references public.payments (id) on delete set null,
  type        text not null check (type in ('earn', 'reverse', 'redeem')),
  stamp_delta integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists reward_ledger_user_idx on public.reward_ledger (user_id, created_at desc);
create index if not exists reward_ledger_booking_idx on public.reward_ledger (booking_id);
create index if not exists reward_ledger_payment_idx on public.reward_ledger (payment_id);

alter table public.reward_ledger enable row level security;
drop policy if exists "Users can view their own reward ledger" on public.reward_ledger;
create policy "Users can view their own reward ledger"
  on public.reward_ledger for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- bookings gains a pre-payment state. A card-paid booking is created
-- 'pending_payment' and only becomes 'upcoming' once the webhook confirms.
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending_payment', 'upcoming', 'completed', 'cancelled'));

-- ---------------------------------------------------------------------------
-- create_pending_booking — the card-payment sibling of create_booking. Runs the
-- IDENTICAL server-side validation + pricing, but inserts the booking as
-- 'pending_payment' and does NOT move money, award a stamp, burn the voucher, or
-- record the coupon redemption — all of that is deferred to settle_booking_payment()
-- once the webhook confirms the payment. Voucher / 0-total bookings never come
-- here (they use the wallet path).
create or replace function public.create_pending_booking(
  p_shop_id     text,
  p_date        date,
  p_slot        text,
  p_service_ids text[],
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_subtotal integer;
  v_discount integer := 0;
  v_coupon_discount integer := 0;
  v_coupon   public.coupons%rowtype;
  v_code     text := nullif(btrim(coalesce(p_coupon_code, '')), '');
  v_total    integer;
  v_booking  uuid;
  v_pct      integer;
  v_closed   boolean;
  v_cap      integer;
  v_count    integer;
  v_weekly   jsonb;
  v_open     time;
  v_close    time;
  v_dow      text := (extract(dow from p_date)::int)::text;
  v_member   boolean;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'no services selected';
  end if;
  if not exists (
    select 1 from public.shops where id = p_shop_id and status = 'approved' and published
  ) then
    raise exception 'shop not available';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_shop_id || p_date::text || p_slot)::bigint);

  select coalesce(o.is_closed, false),
         coalesce(o.max_cars_per_slot, s.max_cars_per_slot),
         s.weekly_hours, s.open_time, s.close_time
    into v_closed, v_cap, v_weekly, v_open, v_close
  from public.shops s
  left join public.shop_slot_overrides o on o.shop_id = s.id and o.date = p_date
  where s.id = p_shop_id;
  if v_closed or public.is_weekly_closed(v_weekly, p_date) then
    raise exception 'shop closed on this date';
  end if;

  if v_weekly is not null and (v_weekly -> v_dow) is not null then
    v_open  := coalesce(nullif(v_weekly -> v_dow ->> 'open',  '')::time, v_open);
    v_close := coalesce(nullif(v_weekly -> v_dow ->> 'close', '')::time, v_close);
  end if;
  if v_open is not null and v_close is not null and p_slot ~ '^[0-9]{1,2}:[0-9]{2}$' then
    if p_slot::time < v_open or p_slot::time >= v_close then
      raise exception 'slot outside opening hours';
    end if;
  end if;

  -- One pending card hold per user per slot: cancel this user's own prior fresh
  -- holds for the same slot (and their payment rows) so repeated "Pay by card"
  -- taps can't stack multiple holds and starve other customers on multi-capacity
  -- slots. A stale link that later gets paid is handled money-safely by
  -- settle_booking_payment (credited to the wallet).
  update public.payments p
     set status = 'cancelled'
    from public.bookings b
   where p.booking_id = b.id and p.kind = 'booking' and p.status = 'created'
     and b.user_id = v_uid and b.shop_id = p_shop_id
     and b.scheduled_date = p_date and b.slot_time = p_slot
     and b.status = 'pending_payment';
  update public.bookings
     set status = 'cancelled'
   where user_id = v_uid and shop_id = p_shop_id
     and scheduled_date = p_date and slot_time = p_slot
     and status = 'pending_payment';

  -- Capacity: confirmed bookings always count; a pending_payment booking only
  -- holds the slot for 30 minutes (the checkout window) so abandoned attempts
  -- don't block the slot forever.
  select count(*) into v_count
  from public.bookings
  where shop_id = p_shop_id and scheduled_date = p_date and slot_time = p_slot
    and status <> 'cancelled'
    and (status <> 'pending_payment' or created_at > now() - interval '30 minutes');
  if v_count >= coalesce(v_cap, 1) then
    raise exception 'slot full';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;

  select coalesce(sum(price), 0) into v_subtotal
  from public.services where id = any (p_service_ids);
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  v_member := v_profile.selected_plan = 'premium'
              and coalesce(v_profile.membership_until, date '1900-01-01') >= current_date;
  if v_member then
    select coalesce(discount_percent, 0) into v_pct from public.plans where id = 'premium';
    if coalesce(v_pct, 0) > 0 then
      v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
    end if;
  end if;

  -- Validate the coupon now (members-only + usage caps). Lock the coupon row to
  -- serialize concurrent redemptions, and count not only recorded redemptions but
  -- also FRESH pending_payment holds that already claimed this code — otherwise a
  -- user could stack several unpaid card holds under a single-use coupon (each
  -- seeing zero redemptions) and pay them all. The redemption row itself is
  -- written by settle_booking_payment once payment confirms.
  if v_code is not null then
    select * into v_coupon from public.coupons
      where code = upper(v_code)
        and (expires_at is null or expires_at >= current_date)
      for update;
    if not found then raise exception 'invalid or expired code'; end if;
    if v_coupon.members_only and not v_member then
      raise exception 'coupon requires membership';
    end if;
    if v_coupon.max_uses is not null
       and (
         (select count(*) from public.coupon_redemptions where coupon_code = v_coupon.code)
         + (select count(*) from public.bookings
              where coupon_code = v_coupon.code and status = 'pending_payment'
                and created_at > now() - interval '30 minutes')
       ) >= v_coupon.max_uses then
      raise exception 'coupon usage limit reached';
    end if;
    if v_coupon.per_user_limit is not null
       and (
         (select count(*) from public.coupon_redemptions where coupon_code = v_coupon.code and user_id = v_uid)
         + (select count(*) from public.bookings
              where coupon_code = v_coupon.code and user_id = v_uid and status = 'pending_payment'
                and created_at > now() - interval '30 minutes')
       ) >= v_coupon.per_user_limit then
      raise exception 'coupon already used';
    end if;
    if coalesce(v_coupon.amount_off, 0) > 0 then
      v_coupon_discount := v_coupon.amount_off;
    elsif coalesce(v_coupon.percent, 0) > 0 then
      v_coupon_discount := round((v_subtotal * v_coupon.percent / 100.0) / 1000) * 1000;
    end if;
    v_coupon_discount := least(v_coupon_discount, greatest(0, v_subtotal - v_discount));
  end if;

  v_total := greatest(0, v_subtotal - v_discount - v_coupon_discount);
  if v_total <= 0 then
    raise exception 'nothing to pay - use the wallet path';
  end if;

  insert into public.bookings
    (user_id, shop_id, scheduled_date, slot_time, plan_id, total,
     free_wash, earned_stamp, status, coupon_code)
  values
    (v_uid, p_shop_id, p_date, p_slot, v_profile.selected_plan, v_total,
     false, true, 'pending_payment',
     case when v_coupon_discount > 0 then v_coupon.code else null end)
  returning id into v_booking;

  insert into public.booking_services (booking_id, service_id, unit_price)
  select v_booking, s.id, s.price
  from public.services s where s.id = any (p_service_ids);

  return jsonb_build_object('booking_id', v_booking, 'amount', v_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- settle_booking_payment — SERVICE ROLE ONLY (the webhook's booking-settle path).
-- Idempotent on the PAYMENT row. Two outcomes, both money-safe:
--   (1) booking still pending_payment AND fully covered (p_received >= total) →
--       deliver: flip to upcoming, award stamp + reward_ledger, record the coupon
--       redemption, mark the payment paid. (The bookings_open_conversation AFTER
--       UPDATE trigger opens the owner thread at this point, not at hold time.)
--   (2) otherwise (booking already cancelled/gone, or the transfer was
--       underpaid) → the customer's captured money MUST NOT vanish: credit the
--       received amount to their wallet as a refund, release any pending hold,
--       and mark the payment paid.
-- This guarantees a captured payment always either delivers the booking or lands
-- in the payer's wallet — never "money taken, nothing given".
create or replace function public.settle_booking_payment(
  p_booking_id uuid, p_payment_id uuid, p_received integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking     public.bookings%rowtype;
  v_pay         public.payments%rowtype;
  v_profile     public.profiles%rowtype;
  v_has_booking boolean;
begin
  -- Lock the payment first (always present); idempotent guard against re-delivery.
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  if v_pay.status = 'paid' then
    return jsonb_build_object('payment_id', p_payment_id, 'already', true);
  end if;
  if coalesce(p_received, 0) <= 0 then raise exception 'invalid received amount'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  v_has_booking := found;

  -- (1) Deliver only when still awaiting payment AND fully covered.
  if v_has_booking and v_booking.status = 'pending_payment' and p_received >= v_booking.total then
    update public.bookings set status = 'upcoming' where id = p_booking_id;

    if v_booking.coupon_code is not null then
      insert into public.coupon_redemptions (coupon_code, user_id, booking_id)
      values (v_booking.coupon_code, v_booking.user_id, p_booking_id);
    end if;

    update public.profiles
      set stamps  = least(5, stamps + 1),
          voucher = (least(5, stamps + 1) >= 5)
      where id = v_booking.user_id;

    insert into public.reward_ledger (user_id, booking_id, payment_id, type, stamp_delta)
    values (v_booking.user_id, p_booking_id, p_payment_id, 'earn', 1);

    update public.payments set status = 'paid' where id = p_payment_id;

    select * into v_profile from public.profiles where id = v_booking.user_id;
    return jsonb_build_object('booking_id', p_booking_id, 'delivered', true,
                             'stamps', v_profile.stamps, 'voucher', v_profile.voucher);
  end if;

  -- (2) Money-safe fallback: booking is gone/cancelled or the transfer was
  -- underpaid. Credit the captured amount to the payer's wallet instead of
  -- losing it, and release any still-pending hold.
  insert into public.wallet_transactions (user_id, booking_id, amount, kind, note)
  values (v_pay.user_id, p_booking_id, p_received, 'refund',
          'PayOS booking payment credited to wallet (booking not completed)');
  update public.profiles set funds = funds + p_received where id = v_pay.user_id;
  if v_has_booking and v_booking.status = 'pending_payment' then
    update public.bookings set status = 'cancelled' where id = p_booking_id;
  end if;
  update public.payments set status = 'paid' where id = p_payment_id;
  return jsonb_build_object('booking_id', p_booking_id, 'credited_to_wallet', p_received);
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_payment_failed — SERVICE ROLE ONLY. The webhook's non-success path, in a
-- single transaction (so the idempotency claim covers both writes): mark the
-- payment failed and release a still-pending booking. Never undoes a settled
-- payment.
create or replace function public.mark_payment_failed(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.payments%rowtype;
begin
  select * into v_p from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  if v_p.status = 'paid' then return; end if;  -- never undo a settled payment

  update public.payments set status = 'failed' where id = p_payment_id and status <> 'paid';
  if v_p.kind = 'booking' and v_p.booking_id is not null then
    update public.bookings set status = 'cancelled'
      where id = v_p.booking_id and status = 'pending_payment';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- settle_topup — SERVICE ROLE ONLY. The webhook's wallet-credit path. Keyed on
-- the payment row and idempotent ON THE PAYMENT STATUS (not just the webhook's
-- event guard): crediting the wallet and marking the payment paid happen in one
-- transaction, so a retried/duplicated delivery can never double-credit. Credits
-- the amount ACTUALLY received from PayOS (p_received), so a manual VietQR
-- under- or over-transfer reconciles to what the customer really paid rather
-- than the requested figure — the customer never loses money either way.
create or replace function public.settle_topup(p_payment_id uuid, p_received integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p      public.payments%rowtype;
  v_funds  integer;
  v_credit integer;
begin
  select * into v_p from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  if v_p.kind <> 'topup' then raise exception 'not a topup payment'; end if;
  if v_p.status = 'paid' then
    return jsonb_build_object('payment_id', p_payment_id, 'already', true);
  end if;

  v_credit := coalesce(p_received, v_p.amount);
  if v_credit <= 0 then raise exception 'invalid received amount'; end if;

  insert into public.wallet_transactions (user_id, amount, kind, note)
  values (v_p.user_id, v_credit, 'topup', 'Top-up via PayOS');

  update public.profiles set funds = funds + v_credit where id = v_p.user_id
  returning funds into v_funds;

  update public.payments set status = 'paid' where id = p_payment_id;

  return jsonb_build_object('payment_id', p_payment_id, 'funds', v_funds);
end;
$$;

-- ---------------------------------------------------------------------------
-- create_booking / update_booking — unchanged except the slot-capacity count now
-- treats a stale (>30 min) pending_payment booking as not occupying the slot, so
-- card-checkout reservations and abandoned attempts are handled consistently.
create or replace function public.create_booking(
  p_shop_id     text,
  p_date        date,
  p_slot        text,
  p_service_ids text[],
  p_use_voucher boolean default false,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_subtotal integer;
  v_discount integer := 0;
  v_coupon_discount integer := 0;
  v_coupon   public.coupons%rowtype;
  v_code     text := nullif(btrim(coalesce(p_coupon_code, '')), '');
  v_total    integer;
  v_free     boolean := false;
  v_stamp    boolean := false;
  v_booking  uuid;
  v_pct      integer;
  v_closed   boolean;
  v_cap      integer;
  v_count    integer;
  v_weekly   jsonb;
  v_open     time;
  v_close    time;
  v_dow      text := (extract(dow from p_date)::int)::text;
  v_member   boolean;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'no services selected';
  end if;
  if not exists (
    select 1 from public.shops where id = p_shop_id and status = 'approved' and published
  ) then
    raise exception 'shop not available';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_shop_id || p_date::text || p_slot)::bigint);

  select coalesce(o.is_closed, false),
         coalesce(o.max_cars_per_slot, s.max_cars_per_slot),
         s.weekly_hours, s.open_time, s.close_time
    into v_closed, v_cap, v_weekly, v_open, v_close
  from public.shops s
  left join public.shop_slot_overrides o on o.shop_id = s.id and o.date = p_date
  where s.id = p_shop_id;
  if v_closed or public.is_weekly_closed(v_weekly, p_date) then
    raise exception 'shop closed on this date';
  end if;

  if v_weekly is not null and (v_weekly -> v_dow) is not null then
    v_open  := coalesce(nullif(v_weekly -> v_dow ->> 'open',  '')::time, v_open);
    v_close := coalesce(nullif(v_weekly -> v_dow ->> 'close', '')::time, v_close);
  end if;
  if v_open is not null and v_close is not null and p_slot ~ '^[0-9]{1,2}:[0-9]{2}$' then
    if p_slot::time < v_open or p_slot::time >= v_close then
      raise exception 'slot outside opening hours';
    end if;
  end if;

  select count(*) into v_count
  from public.bookings
  where shop_id = p_shop_id and scheduled_date = p_date and slot_time = p_slot
    and status <> 'cancelled'
    and (status <> 'pending_payment' or created_at > now() - interval '30 minutes');
  if v_count >= coalesce(v_cap, 1) then
    raise exception 'slot full';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then raise exception 'profile missing'; end if;

  select coalesce(sum(price), 0) into v_subtotal
  from public.services where id = any (p_service_ids);
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  v_member := v_profile.selected_plan = 'premium'
              and coalesce(v_profile.membership_until, date '1900-01-01') >= current_date;
  if v_member then
    select coalesce(discount_percent, 0) into v_pct from public.plans where id = 'premium';
    if coalesce(v_pct, 0) > 0 then
      v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
    end if;
  end if;

  if v_code is not null then
    -- Lock the coupon row and count recorded redemptions PLUS fresh pending_payment
    -- card holds, so a wallet booking can't slip past a cap that an in-flight card
    -- checkout has already claimed (and vice-versa).
    select * into v_coupon from public.coupons
      where code = upper(v_code)
        and (expires_at is null or expires_at >= current_date)
      for update;
    if not found then raise exception 'invalid or expired code'; end if;
    if v_coupon.members_only and not v_member then
      raise exception 'coupon requires membership';
    end if;
    if v_coupon.max_uses is not null
       and (
         (select count(*) from public.coupon_redemptions where coupon_code = v_coupon.code)
         + (select count(*) from public.bookings
              where coupon_code = v_coupon.code and status = 'pending_payment'
                and created_at > now() - interval '30 minutes')
       ) >= v_coupon.max_uses then
      raise exception 'coupon usage limit reached';
    end if;
    if v_coupon.per_user_limit is not null
       and (
         (select count(*) from public.coupon_redemptions where coupon_code = v_coupon.code and user_id = v_uid)
         + (select count(*) from public.bookings
              where coupon_code = v_coupon.code and user_id = v_uid and status = 'pending_payment'
                and created_at > now() - interval '30 minutes')
       ) >= v_coupon.per_user_limit then
      raise exception 'coupon already used';
    end if;
    if coalesce(v_coupon.amount_off, 0) > 0 then
      v_coupon_discount := v_coupon.amount_off;
    elsif coalesce(v_coupon.percent, 0) > 0 then
      v_coupon_discount := round((v_subtotal * v_coupon.percent / 100.0) / 1000) * 1000;
    end if;
    v_coupon_discount := least(v_coupon_discount, greatest(0, v_subtotal - v_discount));
  end if;

  v_total := greatest(0, v_subtotal - v_discount - v_coupon_discount);

  if p_use_voucher then
    if not v_profile.voucher then raise exception 'no voucher available'; end if;
    v_free := true;
    v_total := 0;
  end if;

  if not v_free and v_profile.funds < v_total then
    raise exception 'insufficient funds';
  end if;

  insert into public.bookings
    (user_id, shop_id, scheduled_date, slot_time, plan_id, total,
     free_wash, earned_stamp, status, coupon_code)
  values
    (v_uid, p_shop_id, p_date, p_slot, v_profile.selected_plan, v_total,
     v_free, not v_free, 'upcoming',
     case when v_coupon_discount > 0 then v_coupon.code else null end)
  returning id into v_booking;

  insert into public.booking_services (booking_id, service_id, unit_price)
  select v_booking, s.id, s.price
  from public.services s where s.id = any (p_service_ids);

  if v_coupon_discount > 0 then
    insert into public.coupon_redemptions (coupon_code, user_id, booking_id)
    values (v_coupon.code, v_uid, v_booking);
  end if;

  if v_free then
    update public.profiles
    set voucher = false, pending_voucher = false, stamps = 0
    where id = v_uid;
  else
    if v_total > 0 then
      insert into public.wallet_transactions (user_id, booking_id, amount, kind)
      values (v_uid, v_booking, -v_total, 'charge');
    end if;
    v_stamp := true;
    update public.profiles
    set funds = funds - v_total,
        stamps = least(5, stamps + 1),
        voucher = (least(5, stamps + 1) >= 5)
    where id = v_uid;
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  return jsonb_build_object(
    'booking_id', v_booking, 'total', v_total, 'free_wash', v_free,
    'earned_stamp', v_stamp, 'funds', v_profile.funds,
    'stamps', v_profile.stamps, 'voucher', v_profile.voucher,
    'coupon_discount', v_coupon_discount
  );
end;
$$;

create or replace function public.update_booking(
  p_booking_id  uuid,
  p_date        date,
  p_slot        text,
  p_service_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_booking  public.bookings%rowtype;
  v_profile  public.profiles%rowtype;
  v_subtotal integer;
  v_pct      integer := 0;
  v_discount integer := 0;
  v_coupon_discount integer := 0;
  v_coupon   public.coupons%rowtype;
  v_total    integer;
  v_delta    integer;
  v_funds    integer;
  v_closed   boolean;
  v_cap      integer;
  v_count    integer;
  v_weekly   jsonb;
  v_open     time;
  v_close    time;
  v_dow      text := (extract(dow from p_date)::int)::text;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'no services selected';
  end if;

  select * into v_booking from public.bookings
  where id = p_booking_id and user_id = v_uid
  for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status <> 'upcoming' then
    raise exception 'only upcoming bookings can be edited';
  end if;

  if not exists (
    select 1 from public.shops where id = v_booking.shop_id and status = 'approved' and published
  ) then
    raise exception 'shop not available';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_booking.shop_id || p_date::text || p_slot)::bigint);

  select coalesce(o.is_closed, false),
         coalesce(o.max_cars_per_slot, s.max_cars_per_slot),
         s.weekly_hours, s.open_time, s.close_time
    into v_closed, v_cap, v_weekly, v_open, v_close
  from public.shops s
  left join public.shop_slot_overrides o on o.shop_id = s.id and o.date = p_date
  where s.id = v_booking.shop_id;
  if v_closed or public.is_weekly_closed(v_weekly, p_date) then
    raise exception 'shop closed on this date';
  end if;

  if v_weekly is not null and (v_weekly -> v_dow) is not null then
    v_open  := coalesce(nullif(v_weekly -> v_dow ->> 'open',  '')::time, v_open);
    v_close := coalesce(nullif(v_weekly -> v_dow ->> 'close', '')::time, v_close);
  end if;
  if v_open is not null and v_close is not null and p_slot ~ '^[0-9]{1,2}:[0-9]{2}$' then
    if p_slot::time < v_open or p_slot::time >= v_close then
      raise exception 'slot outside opening hours';
    end if;
  end if;

  select count(*) into v_count
  from public.bookings
  where shop_id = v_booking.shop_id and scheduled_date = p_date and slot_time = p_slot
    and status <> 'cancelled' and id <> p_booking_id
    and (status <> 'pending_payment' or created_at > now() - interval '30 minutes');
  if v_count >= coalesce(v_cap, 1) then
    raise exception 'slot full';
  end if;

  select coalesce(sum(price), 0) into v_subtotal
  from public.services where id = any (p_service_ids);
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.selected_plan = 'premium'
     and coalesce(v_profile.membership_until, date '1900-01-01') >= current_date then
    select coalesce(discount_percent, 0) into v_pct from public.plans where id = 'premium';
    if coalesce(v_pct, 0) > 0 then
      v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
    end if;
  end if;

  if v_booking.coupon_code is not null then
    select * into v_coupon from public.coupons
      where code = upper(v_booking.coupon_code)
        and (expires_at is null or expires_at >= current_date);
    if found then
      if coalesce(v_coupon.amount_off, 0) > 0 then
        v_coupon_discount := v_coupon.amount_off;
      elsif coalesce(v_coupon.percent, 0) > 0 then
        v_coupon_discount := round((v_subtotal * v_coupon.percent / 100.0) / 1000) * 1000;
      end if;
      v_coupon_discount := least(v_coupon_discount, greatest(0, v_subtotal - v_discount));
    end if;
  end if;

  v_total := greatest(0, v_subtotal - v_discount - v_coupon_discount);

  if v_booking.free_wash then v_total := 0; end if;

  v_delta := v_booking.total - v_total;
  v_funds := v_profile.funds;
  if v_delta < 0 and v_funds < -v_delta then
    raise exception 'insufficient funds';
  end if;

  update public.bookings
  set scheduled_date = p_date, slot_time = p_slot, total = v_total
  where id = p_booking_id;

  delete from public.booking_services where booking_id = p_booking_id;
  insert into public.booking_services (booking_id, service_id, unit_price)
  select p_booking_id, s.id, s.price
  from public.services s where s.id = any (p_service_ids);

  if v_delta <> 0 then
    insert into public.wallet_transactions (user_id, booking_id, amount, kind)
    values (v_uid, p_booking_id, v_delta, case when v_delta > 0 then 'refund' else 'charge' end);
    update public.profiles set funds = funds + v_delta where id = v_uid
    returning funds into v_funds;
  end if;

  return jsonb_build_object('booking_id', p_booking_id, 'total', v_total,
                            'delta', v_delta, 'funds', v_funds);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. top_up() is now off-limits to clients (wallet credit is webhook-only).
revoke execute on function public.top_up(integer, text) from authenticated, anon, public;

revoke execute on function public.create_pending_booking(text, date, text, text[], text) from public, anon;
grant  execute on function public.create_pending_booking(text, date, text, text[], text) to authenticated;

-- Service-role-only functions: the webhook (service role) is the only caller.
revoke execute on function public.settle_booking_payment(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.mark_payment_failed(uuid) from public, anon, authenticated;
revoke execute on function public.settle_topup(uuid, integer) from public, anon, authenticated;
grant  execute on function public.settle_booking_payment(uuid, uuid, integer) to service_role;
grant  execute on function public.mark_payment_failed(uuid) to service_role;
grant  execute on function public.settle_topup(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- slot_availability — mirror the booking RPCs' capacity predicate so the UI's
-- greyed-out slots match what create_booking/create_pending_booking enforce: a
-- stale (>30 min) pending_payment hold no longer counts as occupying the slot.
-- (Without this, an abandoned card hold would show a slot as full forever.)
create or replace function public.slot_availability(p_shop_id text, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed boolean;
  v_cap    integer;
  v_counts jsonb;
begin
  select coalesce(o.is_closed, false),
         coalesce(o.max_cars_per_slot, s.max_cars_per_slot)
    into v_closed, v_cap
  from public.shops s
  left join public.shop_slot_overrides o on o.shop_id = s.id and o.date = p_date
  where s.id = p_shop_id and s.status = 'approved' and s.published;
  if not found then
    return jsonb_build_object('closed', true, 'cap', 0, 'counts', '{}'::jsonb);
  end if;

  select coalesce(jsonb_object_agg(slot_time, c), '{}'::jsonb) into v_counts
  from (
    select slot_time, count(*) as c
    from public.bookings
    where shop_id = p_shop_id and scheduled_date = p_date
      and status <> 'cancelled'
      and (status <> 'pending_payment' or created_at > now() - interval '30 minutes')
    group by slot_time
  ) q;

  return jsonb_build_object('closed', v_closed, 'cap', coalesce(v_cap, 1), 'counts', v_counts);
end;
$$;
grant execute on function public.slot_availability(text, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Booking conversation — do NOT open an owner thread / post a "Booking confirmed"
-- message for an unpaid card hold (status = 'pending_payment'). The thread is
-- opened only when the booking actually goes live: on the wallet path the row is
-- inserted 'upcoming' (AFTER INSERT, unchanged); on the card path it transitions
-- pending_payment -> upcoming in settle_booking_payment (AFTER UPDATE, new).
create or replace function public.open_conversation_for_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_conv  uuid;
  v_owner uuid;
begin
  -- Unpaid hold: no conversation yet (a later confirmation reraises this via the
  -- AFTER UPDATE trigger once the booking is 'upcoming').
  if new.status = 'pending_payment' then return new; end if;

  insert into public.conversations (kind, shop_id, booking_id, created_by)
  values ('shop', new.shop_id, new.id, new.user_id)
  on conflict (booking_id) do nothing
  returning id into v_conv;
  if v_conv is null then return new; end if;  -- already exists

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conv, new.user_id)
  on conflict do nothing;

  select owner_id into v_owner from public.shops where id = new.shop_id;
  if v_owner is not null and v_owner <> new.user_id then
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conv, v_owner)
    on conflict do nothing;
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (
    v_conv,
    new.user_id,
    'Booking confirmed for ' || to_char(new.scheduled_date, 'FMMon FMDD, YYYY') || ' at ' || new.slot_time || '.'
  );

  return new;
end; $$;
revoke execute on function public.open_conversation_for_booking() from public, anon, authenticated;

-- Open the thread when a card hold is confirmed (pending_payment -> upcoming).
drop trigger if exists bookings_open_conversation_on_pay on public.bookings;
create trigger bookings_open_conversation_on_pay
  after update on public.bookings
  for each row
  when (old.status = 'pending_payment' and new.status = 'upcoming')
  execute function public.open_conversation_for_booking();
