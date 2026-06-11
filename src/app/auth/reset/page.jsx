"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client.js";
import { Button } from "../../../components/ui/Button.jsx";

// Landing page for the password-reset email link. Supabase redirects here with
// a recovery `?code` (PKCE). We establish the recovery session client-side,
// then let the user set a new password via updateUser().
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false); // recovery session established?
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(null); // null | "loading" | "done" | error string

  const linkInvalid =
    "This reset link is invalid or has expired. Please request a new one.";

  useEffect(() => {
    if (!supabase) {
      setStatus("Auth isn't configured.");
      return;
    }
    let active = true;

    async function init() {
      // The SDK may auto-exchange the code from the URL on load; check first.
      const existing = await supabase.auth.getSession();
      if (existing.data.session) {
        if (active) setReady(true);
        return;
      }
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) {
        if (active) setStatus(linkInvalid);
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!active) return;
      if (error) {
        // Could be a race with the SDK's own auto-exchange — re-check session.
        const retry = await supabase.auth.getSession();
        if (retry.data.session) setReady(true);
        else setStatus(linkInvalid);
        return;
      }
      setReady(true);
    }

    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && active) setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(event) {
    event.preventDefault();
    setStatus("loading");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setStatus(error.message);
    setStatus("done");
    router.push("/account");
  }

  return (
    <section className="grid h-full place-items-center bg-white px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl font-black">Set a new password</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Enter a new password for your account.
        </p>

        {ready ? (
          <form onSubmit={onSubmit} className="mt-6 grid gap-3">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              className="min-h-11 rounded-2xl border border-black/10 px-4 text-sm outline-none focus:border-wash-500"
            />
            <Button type="submit" className="w-full" disabled={status === "loading"}>
              {status === "loading" ? "Saving…" : "Update password"}
            </Button>
          </form>
        ) : (
          !status && <p className="mt-6 text-sm text-neutral-500">Verifying reset link…</p>
        )}

        {status && !["loading", "done"].includes(status) && (
          <p className="mt-3 text-sm text-red-600">{status}</p>
        )}
      </div>
    </section>
  );
}
