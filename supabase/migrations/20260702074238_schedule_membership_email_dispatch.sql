-- 0064 SCHEDULE MEMBERSHIP EMAIL DISPATCH — invoke the dispatch-membership-emails
-- edge function every 30 minutes so queued rows in membership_email_outbox get
-- delivered (and failed rows retried) promptly.
--
-- PREREQUISITES (do these BEFORE applying this migration, or the job will post
-- with an empty token and the function will reject it):
--   1. Deploy the edge function:  supabase functions deploy dispatch-membership-emails
--   2. Set its secrets:           supabase secrets set RESEND_API_KEY=... MEMBERSHIP_EMAIL_FROM='WASHGO <noreply@yourdomain.com>'
--   3. Store the project's service-role key in Vault so this job can authenticate:
--        select vault.create_secret('<your-service-role-key>', 'service_role_key');
--      (Dashboard → Project Settings → API → service_role key. Keep it secret; it
--       lives only in Vault, never in this file.)
--
-- Re-runnable: drops any existing job of this name first.

create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('dispatch-membership-emails');
exception when others then
  null; -- not scheduled yet
end;
$$;

select cron.schedule(
  'dispatch-membership-emails',
  '*/30 * * * *',
  $job$
  select net.http_post(
    url := 'https://zbxpykegoycklijvwkgq.supabase.co/functions/v1/dispatch-membership-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $job$
);
