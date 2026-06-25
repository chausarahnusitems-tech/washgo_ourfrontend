-- 0052 DEV WALLET UNLOCK — a SERVICE-ROLE-ONLY helper to credit a wallet for
-- local testing. This exists so a developer can give their own test account
-- funds without going through the real PayOS checkout.
--
-- SECURITY: this function is granted ONLY to `service_role`. It is revoked from
-- public/anon/authenticated, so a signed-in customer CANNOT call it via PostgREST
-- (/rest/v1/rpc/dev_add_funds) — their JWT carries the anon/authenticated role,
-- not service_role. The only caller is the server-side /api/dev/add-funds route,
-- which uses the service-role key (never shipped to the browser) AND is itself
-- gated to non-production + an explicit DEV_WALLET_UNLOCK flag. In production the
-- function is therefore dormant and unreachable. It mirrors the existing
-- service-role-only money RPCs (settle_topup / settle_booking_payment).
create or replace function public.dev_add_funds(
  p_user_id uuid,
  p_amount  integer default 1000000000,
  p_note    text default 'Dev wallet unlock'
)
returns integer  -- new balance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funds integer;
  v_add   integer;
  v_cap   constant integer := 2000000000;  -- stay well under int4 max (~2.147B)
begin
  if p_user_id is null then raise exception 'user required'; end if;

  select funds into v_funds from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile missing'; end if;

  -- Clamp the credit so the resulting balance can never overflow the int4 column.
  v_add := least(greatest(0, coalesce(p_amount, 0)), v_cap - v_funds);
  if v_add < 0 then v_add := 0; end if;

  if v_add > 0 then
    insert into public.wallet_transactions (user_id, amount, kind, note)
    values (p_user_id, v_add, 'adjustment', p_note);
    update public.profiles set funds = funds + v_add where id = p_user_id
    returning funds into v_funds;
  end if;

  return v_funds;
end;
$$;

-- Service-role ONLY. Customers (anon/authenticated) cannot execute this.
revoke execute on function public.dev_add_funds(uuid, integer, text) from public, anon, authenticated;
grant  execute on function public.dev_add_funds(uuid, integer, text) to service_role;
