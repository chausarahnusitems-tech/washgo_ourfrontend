-- 0011 update_booking RPC — the edit-an-upcoming-booking write path the
-- frontend's BookingDetailScreen needs. Mirrors the local updateBooking() in
-- AppContext: reprice under the booking's ORIGINAL plan (not the user's current
-- plan), adjust the wallet by only the delta, and never touch loyalty stamps
-- (an edit neither earns nor burns a stamp). Owner-scoped + row-locked.
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
  v_subtotal integer;
  v_pct      integer := 0;
  v_discount integer := 0;
  v_total    integer;
  v_delta    integer;       -- old - new : positive = refund, negative = extra charge
  v_funds    integer;
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

  select coalesce(sum(price), 0) into v_subtotal
  from public.services where id = any (p_service_ids);
  if v_subtotal <= 0 then raise exception 'unknown services'; end if;

  -- Reprice under the plan the booking was made on (mirrors the UI: 10% off,
  -- rounded to the nearest 1.000₫).
  select coalesce(discount_percent, 0) into v_pct
  from public.plans where id = v_booking.plan_id;
  if coalesce(v_pct, 0) > 0 then
    v_discount := round((v_subtotal * v_pct / 100.0) / 1000) * 1000;
  end if;
  v_total := greatest(0, v_subtotal - v_discount);

  -- A free-wash booking stays free on edit (never retro-charges the voucher).
  if v_booking.free_wash then
    v_total := 0;
  end if;

  v_delta := v_booking.total - v_total;
  select funds into v_funds from public.profiles where id = v_uid for update;
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

revoke execute on function public.update_booking(uuid, date, text, text[]) from public, anon;
grant execute on function public.update_booking(uuid, date, text, text[]) to authenticated;
