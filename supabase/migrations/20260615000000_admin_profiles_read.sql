-- 0012 ADMIN PROFILES READ — the moderation console needs to show who owns each
-- shop in the approval queue. profiles SELECT was self-only ("Profiles are
-- viewable by their owner"); add an admin-scoped read alongside it.
--
-- is_admin() is SECURITY DEFINER and reads current_user_role() (also definer),
-- so this policy does not recurse into profiles' own RLS.
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());
