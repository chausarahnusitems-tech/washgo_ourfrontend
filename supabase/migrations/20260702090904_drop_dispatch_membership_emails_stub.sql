-- 0065 DROP dispatch_membership_emails() stub — superseded by the
-- dispatch-membership-emails edge function, which reads membership_email_outbox
-- and delivers via Resend directly. The SQL function was only ever a no-op
-- placeholder and nothing references it (the pg_cron dispatch job calls the edge
-- function over HTTP, not this).
drop function if exists public.dispatch_membership_emails();
