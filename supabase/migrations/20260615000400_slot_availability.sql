-- 0016 SLOT AVAILABILITY — customers can't read other users' bookings (RLS), so
-- this SECURITY DEFINER function returns only aggregate per-slot counts plus the
-- effective cap / closed flag for a shop+date, so the booking UI can grey out
-- full or closed slots without exposing who booked.
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
    where shop_id = p_shop_id and scheduled_date = p_date and status <> 'cancelled'
    group by slot_time
  ) q;

  return jsonb_build_object('closed', v_closed, 'cap', coalesce(v_cap, 1), 'counts', v_counts);
end;
$$;

grant execute on function public.slot_availability(text, date) to anon, authenticated;
