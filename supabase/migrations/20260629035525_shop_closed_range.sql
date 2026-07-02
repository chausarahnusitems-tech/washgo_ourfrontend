-- 0062 CLOSE SHOP FOR A PERIOD — owners can already close individual dates or set
-- a custom per-slot cap (shop_slot_overrides). This adds a bulk helper to close
-- (or reopen) a whole DATE RANGE at once, e.g. a holiday. Closures are enforced
-- by the existing booking RPCs (create_booking checks shop_slot_overrides.is_closed).
create or replace function public.set_shop_closed_range(
  p_shop_id text,
  p_from    date,
  p_to      date,
  p_closed  boolean default true
)
returns integer  -- number of days affected
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_count integer := 0;
  d       date;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not exists (
    select 1 from public.shops s where s.id = p_shop_id and (s.owner_id = v_uid or public.is_admin())
  ) then
    raise exception 'not allowed';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid range';
  end if;
  if (p_to - p_from) > 180 then
    raise exception 'range too long (max 180 days)';
  end if;

  d := p_from;
  while d <= p_to loop
    if p_closed then
      -- Close the day; preserve any custom per-slot cap already set on it.
      insert into public.shop_slot_overrides (shop_id, date, is_closed)
      values (p_shop_id, d, true)
      on conflict (shop_id, date) do update set is_closed = true;
    else
      -- Reopen: remove a pure closure override; if the day also carried a custom
      -- cap, just clear the closed flag (keep the cap).
      delete from public.shop_slot_overrides
        where shop_id = p_shop_id and date = d and is_closed = true and max_cars_per_slot is null;
      update public.shop_slot_overrides set is_closed = false
        where shop_id = p_shop_id and date = d;
    end if;
    v_count := v_count + 1;
    d := d + 1;
  end loop;

  return v_count;
end;
$function$;

revoke execute on function public.set_shop_closed_range(text, date, date, boolean) from public, anon;
grant  execute on function public.set_shop_closed_range(text, date, date, boolean) to authenticated;
