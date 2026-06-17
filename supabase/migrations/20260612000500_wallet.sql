-- 0005 WALLET LEDGER — every movement of money is a row here; profiles.funds
-- is the running balance. CRITICAL: there are NO insert/update/delete policies
-- and no column grants — clients can only READ their own history. All writes
-- happen inside the SECURITY DEFINER wallet/booking RPCs, so a client can
-- never mint, alter, or erase money movements.

create table if not exists public.wallet_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  -- Signed VND: positive = money in (topup, refund), negative = money out (charge).
  amount     integer not null check (amount <> 0),
  kind       text not null check (kind in ('topup', 'charge', 'refund', 'adjustment')),
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists wallet_tx_user_idx
  on public.wallet_transactions (user_id, created_at desc);

alter table public.wallet_transactions enable row level security;

drop policy if exists "Users can view their own transactions" on public.wallet_transactions;
create policy "Users can view their own transactions"
  on public.wallet_transactions for select
  to authenticated
  using ((select auth.uid()) = user_id);
