// Membership email dispatcher.
//
// Delivers the queued rows in public.membership_email_outbox (written by the
// daily process_membership_renewals() sweep) through Resend, then stamps each
// row sent — or records the error so the next run retries it. Nothing is ever
// deleted, so the outbox stays a full audit trail.
//
// Invoked on a schedule by pg_cron (see
// supabase/migrations/20260630050000_schedule_membership_email_dispatch.sql),
// which calls this function with the project's service-role key as a Bearer
// token. Platform JWT verification (verify_jwt = true) gates access; an optional
// CRON_SECRET header check adds defense-in-depth when that secret is set.
//
// Function secrets to configure (supabase secrets set ...):
//   RESEND_API_KEY        - your Resend API key (re_...)              [required]
//   MEMBERSHIP_EMAIL_FROM - verified sender, e.g.
//                           "WASHGO <noreply@yourdomain.com>"          [required for prod]
//   CRON_SECRET           - optional shared secret; if set, callers must send it
//                           as the x-cron-secret header                [optional]
// Auto-injected by Supabase (do NOT set these yourself):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("MEMBERSHIP_EMAIL_FROM") ?? "WASHGO <onboarding@resend.dev>";
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH_SIZE = 50;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  // Optional shared-secret gate (only enforced when CRON_SECRET is configured).
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "forbidden" }, 403);
  }
  if (!RESEND_API_KEY) {
    return json({ error: "RESEND_API_KEY is not configured" }, 500);
  }

  // Service-role client bypasses the outbox's RLS (which has no public policies).
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Oldest-first batch of undelivered notifications.
  const { data: rows, error } = await supabase
    .from("membership_email_outbox")
    .select("id, email, subject, body")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
          // Resend de-dupes on this key, so re-sending a row (e.g. after a
          // sent_at-update failure) never delivers a second copy.
          "Idempotency-Key": row.id,
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [row.email],
          subject: row.subject,
          text: row.body,
        }),
      });

      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        await supabase
          .from("membership_email_outbox")
          .update({ error: `resend ${res.status}: ${detail}` })
          .eq("id", row.id);
        failed++;
        continue;
      }

      // Delivered: stamp sent_at so it's never re-sent, and clear any prior error.
      await supabase
        .from("membership_email_outbox")
        .update({ sent_at: new Date().toISOString(), error: null })
        .eq("id", row.id);
      sent++;
    } catch (e) {
      await supabase
        .from("membership_email_outbox")
        .update({ error: String(e).slice(0, 300) })
        .eq("id", row.id);
      failed++;
    }
  }

  return json({ processed: rows?.length ?? 0, sent, failed });
});
