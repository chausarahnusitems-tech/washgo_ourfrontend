"use client";

import { useEffect, useRef } from "react";
import { createClient } from "../../../lib/supabase/client.js";

// OAuth / magic-link landing page. Supabase redirects here with a `?code` (PKCE)
// which we exchange for a session CLIENT-SIDE.
//
// WHY CLIENT-SIDE: the browser client wrote the PKCE `-code-verifier` cookie when
// the flow started, so reading it back here is same-origin and reliable. The
// previous server-side route had to read that verifier off a cross-site redirect
// request and ship the (chunked) session cookies on a 302 — on the first attempt
// the verifier wasn't present, the exchange threw PKCE-verifier-missing, and the
// user landed signed-out with only the verifier cookie: the "have to sign in
// twice" bug. Exchanging in the browser (same pattern as /auth/reset) avoids the
// cross-site read and the redirect-response cookie shipping entirely.
export default function AuthCallbackPage() {
  const supabase = createClient();
  const handled = useRef(false);

  useEffect(() => {
    if (!supabase) {
      window.location.assign("/login?error=auth");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    // Only resume to a relative, same-origin path — never an attacker-controlled
    // host (`//evil.com`, `/\evil.com`, an absolute URL). Otherwise default Home.
    const requested = params.get("next") ?? "/";
    const next =
      requested.startsWith("/") &&
      !requested.startsWith("//") &&
      !requested.startsWith("/\\")
        ? requested
        : "/";

    let active = true;

    // Full reload so AppProvider re-initialises with the new session cookie and
    // the signed-in UI shows on the FIRST attempt.
    function finish() {
      if (handled.current) return;
      handled.current = true;
      window.location.assign(next);
    }
    function fail() {
      if (handled.current) return;
      handled.current = true;
      window.location.assign("/login?error=auth");
    }

    async function run() {
      // The browser client auto-detects `?code` on load (detectSessionInUrl), so
      // a session may already exist by the time this runs.
      const existing = await supabase.auth.getSession();
      if (!active) return;
      if (existing.data.session) return finish();

      const code = params.get("code");
      if (!code) return fail();

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!active) return;
      if (error) {
        // Could be a race with the SDK's own auto-exchange — re-check session.
        const retry = await supabase.auth.getSession();
        if (retry.data.session) return finish();
        return fail();
      }
      finish();
    }

    run();
    // Catches a session established by the SDK's auto-exchange after this mounts.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <section className="grid h-full place-items-center bg-white px-6">
      <p className="text-sm text-neutral-500">Signing you in…</p>
    </section>
  );
}
