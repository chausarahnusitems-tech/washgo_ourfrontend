-- 0009 HARDENING — clears the security-advisor warnings and locks down
-- internal functions that should never be callable through PostgREST.

-- handle_new_user is invoked by the auth.users trigger only; it must not be
-- exposed as /rest/v1/rpc/handle_new_user. (Triggers fire with the function
-- owner's rights, so revoking EXECUTE does not affect signups.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Same for the other trigger-only functions.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.recompute_shop_rating() from public, anon, authenticated;

-- NOT DOABLE IN SQL — flip in the dashboard:
--   Authentication → Sign In / Providers → "Leaked password protection"
-- (the third advisor warning: checks passwords against HaveIBeenPwned).
