-- 0056 SCHEDULE AUTO-MISS — run expire_missed_bookings() every 5 minutes so a
-- no-show booking is marked 'missed' + refunded within ~5 min of the 1h cutoff.
create extension if not exists pg_cron;

-- Re-schedulable: drop any existing job of this name first.
do $$
begin
  perform cron.unschedule('expire-missed-bookings');
exception when others then
  null; -- not scheduled yet
end;
$$;

select cron.schedule('expire-missed-bookings', '*/5 * * * *', $job$ select public.expire_missed_bookings(); $job$);
