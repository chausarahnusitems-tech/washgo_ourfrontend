-- Allow a customer to keep up to 5 concurrent OPEN support chats. Previously the
-- support branch found-or-reused a single open thread; now each "Contact support"
-- opens a fresh thread until the cap is reached, then raises 'support_chat_limit'.
-- The shop branch is unchanged (still one open generic thread per shop).
create or replace function public.open_conversation(p_kind text, p_shop_id text default null, p_tags text[] default '{}'::text[])
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_conv  uuid;
  v_owner uuid;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_kind not in ('shop', 'support') then raise exception 'invalid kind'; end if;
  if p_kind = 'support' and public.is_admin() then
    raise exception 'admins do not open support threads';
  end if;

  if p_kind = 'shop' then
    if p_shop_id is null then raise exception 'shop required'; end if;
    select owner_id into v_owner from public.shops where id = p_shop_id;
    select id into v_conv from public.conversations
      where kind = 'shop' and shop_id = p_shop_id and created_by = v_uid
        and booking_id is null            -- keep the generic thread distinct from per-booking ones
        and status <> 'closed'
      order by created_at desc
      limit 1;
    if v_conv is null then
      insert into public.conversations (kind, shop_id, created_by, problem_tags)
      values ('shop', p_shop_id, v_uid, coalesce(p_tags, '{}')) returning id into v_conv;
      insert into public.conversation_participants (conversation_id, user_id)
      values (v_conv, v_uid) on conflict do nothing;
      if v_owner is not null then
        insert into public.conversation_participants (conversation_id, user_id)
        values (v_conv, v_owner) on conflict do nothing;
      end if;
    end if;
  else
    -- Support: up to 5 concurrent open threads per user. Each call opens a NEW
    -- thread (so a customer can raise several issues at once) until the cap.
    if (
      select count(*) from public.conversations
      where kind = 'support' and created_by = v_uid and status <> 'closed'
    ) >= 5 then
      raise exception 'support_chat_limit';
    end if;
    insert into public.conversations (kind, created_by, problem_tags)
    values ('support', v_uid, coalesce(p_tags, '{}')) returning id into v_conv;
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conv, v_uid) on conflict do nothing;
  end if;

  return v_conv;
end;
$function$;
