"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client.js";
import { Button } from "../../../components/ui/Button.jsx";

// Shown once to first-time Google users (who have no email/password). Setting a
// password lets them sign in manually by email next time. Either choice stamps
// `pw_prompted` in user_metadata so they're never nagged again.
function SetPasswordInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(null); // null | "loading" | error string
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");

  const requested = searchParams.get("next") || "/";
  // Only resume to a relative, same-origin path.
  const next =
    requested.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/\\")
      ? requested
      : "/";

  useEffect(() => {
    if (!supabase) {
      setStatus("Auth isn't configured.");
      return;
    }
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data?.user) {
        window.location.assign("/login");
        return;
      }
      setEmail(data.user.email || "");
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  // Persist the one-time flag and (optionally) the password, then continue.
  async function commit(withPassword) {
    setStatus("loading");
    const patch = { data: { pw_prompted: true } };
    if (withPassword) patch.password = password;
    const { error } = await supabase.auth.updateUser(patch);
    if (error) {
      setStatus(error.message);
      return;
    }
    window.location.assign(next); // full reload so the provider re-reads the session
  }

  async function onSubmit(event) {
    event.preventDefault();
    await commit(true);
  }

  return (
    <section className="grid h-full place-items-center bg-white px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl font-black">Set a password</h1>
        <p className="mt-2 text-sm text-neutral-600">
          You signed in with Google. Add a password so you can also sign in with{" "}
          <strong>{email || "your email"}</strong> next time.
        </p>

        {ready ? (
          <>
            <form onSubmit={onSubmit} className="mt-6 grid gap-3">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                autoComplete="new-password"
                className="min-h-11 rounded-2xl border border-black/10 px-4 text-sm outline-none focus:border-wash-500"
              />
              <Button type="submit" className="w-full" disabled={status === "loading"}>
                {status === "loading" ? "Saving…" : "Set password"}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => commit(false)}
              disabled={status === "loading"}
              className="mt-3 w-full text-sm font-semibold text-neutral-500"
            >
              Skip for now
            </button>
          </>
        ) : (
          !status && <p className="mt-6 text-sm text-neutral-500">Loading…</p>
        )}

        {status && status !== "loading" && (
          <p className="mt-3 text-sm text-red-600">{status}</p>
        )}
      </div>
    </section>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordInner />
    </Suspense>
  );
}
