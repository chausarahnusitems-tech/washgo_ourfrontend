-- When a customer cancels a booking, auto-close its per-booking chat with the
-- shop so a dropped booking doesn't leave an open thread lingering. Idempotent
-- (only touches a still-open thread). Everything else is unchanged.
create or replace function public.cancel_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not signed in'; end if;

  select * into v_booking from public.bookings
  where id = p_booking_id and user_id = v_uid
  for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status <> 'upcoming' then
    raise exception 'only upcoming bookings can be cancelled';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;

  update public.bookings set status = 'cancelled' where id = p_booking_id;

  if v_booking.total > 0 then
    insert into public.wallet_transactions (user_id, booking_id, amount, kind)
    values (v_uid, p_booking_id, v_booking.total, 'refund');
  end if;

  update public.profiles
  set funds = funds + v_booking.total,
      -- A cancelled free wash restores the voucher (card stays restarted);
      -- a cancelled stamp-earning booking takes its stamp (and any voucher
      -- that stamp unlocked) back.
      voucher = case
        when v_booking.free_wash then true
        when v_booking.earned_stamp then (greatest(0, stamps - 1) >= 5)
        else voucher end,
      stamps = case
        when v_booking.earned_stamp then greatest(0, stamps - 1)
        else stamps end
  where id = v_uid;

  -- Close the per-booking chat with the shop (idempotent: only if still open).
  update public.conversations
  set status = 'closed', closed_at = now(), closed_by = v_uid
  where booking_id = p_booking_id and status <> 'closed';

  select * into v_profile from public.profiles where id = v_uid;
  return jsonb_build_object(
    'refunded', v_booking.total,
    'funds', v_profile.funds,
    'stamps', v_profile.stamps,
    'voucher', v_profile.voucher
  );
end;
$function$;
