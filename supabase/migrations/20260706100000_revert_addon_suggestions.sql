-- 0065 REVERT ADD-ON SUGGESTIONS
-- Reverses 20260703100000_addon_suggestions.sql — the owner add-on suggestion
-- feature was pulled. Drops the RPCs, the messages anchor column, and the table
-- (verified empty at revert time). Service details (0064) are unaffected.

drop function if exists public.suggest_addon(uuid, text, integer, text, text[], uuid);
drop function if exists public.respond_addon(uuid, boolean);

alter table public.messages drop column if exists addon_suggestion_id;

drop table if exists public.booking_addon_suggestions;

notify pgrst, 'reload schema';
