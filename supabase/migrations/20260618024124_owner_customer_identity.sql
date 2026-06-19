-- 0047 OWNER SEES CUSTOMER — when a shop owner messages a customer about a
-- booking, let them see who they're talking to. profiles RLS is self-only, so a
-- SECURITY DEFINER RPC exposes just the customer's name/phone for a conversation
-- the caller owns the shop of (reuses is_shop_owner_of_conversation from 0039).

create or replace function public.get_conversation_customer(p_conv uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_customer uuid;
  v_profile  public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  -- Only the shop's current owner (or an admin) may resolve the customer.
  if not (public.is_shop_owner_of_conversation(p_conv) or public.is_admin()) then
    raise exception 'not allowed';
  end if;

  -- The customer is the thread creator (the booking's owner opened/owns it).
  select created_by into v_customer from public.conversations where id = p_conv;
  if v_customer is null then return null; end if;

  select * into v_profile from public.profiles where id = v_customer;
  if not found then return null; end if;

  return jsonb_build_object(
    'full_name', v_profile.full_name,
    'phone', v_profile.phone
  );
end;
$$;

revoke execute on function public.get_conversation_customer(uuid) from public, anon;
grant  execute on function public.get_conversation_customer(uuid) to authenticated;
