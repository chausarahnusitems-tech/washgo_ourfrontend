"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client.js";
import { Button } from "../../components/ui/Button.jsx";

// Progressive-access auth: the app is usable signed-out, so this screen is
// opt-in. Two explicit modes — "signin" for existing users, "signup" for new
// ones (collects a name, saved to the profile via the auth trigger) — plus
// one-click Google.
export default function LoginPage() {
  const supabase = createClient();

  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "reset"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // null | "loading" | "check-email" | "reset-sent" | "exists" | error string
  const [status, setStatus] = useState(null);

  const isSignup = mode === "signup";
  const isReset = mode === "reset";
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;
  const notConfigured = "Sign-in isn't configured yet — add Supabase env vars.";

  // The /auth/callback route bounces failed exchanges (expired/invalid link,
  // PKCE verifier missing — e.g. the email link opened on a different device)
  // here with ?error=auth. Surface it instead of showing a pristine form, which
  // otherwise looks like the user did nothing wrong. Rendered by the red-text
  // block below since it isn't one of the reserved status values.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth") {
      setStatus(
        "Sign-in link was invalid or expired. Please try again — if you signed up on another device, open the confirmation link there."
      );
    }
  }, []);

  function switchMode(next) {
    setMode(next);
    setStatus(null);
    setPassword("");
  }

  async function signInWithGoogle() {
    setStatus(null);
    if (!supabase) return setStatus(notConfigured);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) setStatus(error.message);
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!supabase) return setStatus(notConfigured);
    setStatus("loading");

    if (isSignup) {
      // `data.full_name` lands in user_metadata, which the `handle_new_user`
      // trigger copies into the profiles row.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo }
      });
      if (error) {
        // "User already registered" is returned when email confirmation is off.
        if (/already.*regist/i.test(error.message)) return goToSignin();
        return setStatus(error.message);
      }
      // When BOTH "Confirm email" and "Confirm phone" are enabled, signing up
      // with an existing email returns an obfuscated user whose identities array
      // is EMPTY (best-effort anti-enumeration — not a guaranteed contract).
      // A genuinely new signup has identities.length === 1, so this won't
      // misfire. With either confirmation off, the error branch above handles it.
      if (data.user && data.user.identities?.length === 0) {
        return goToSignin();
      }
      // No session means email confirmation is enabled — user must verify first.
      if (!data.session) return setStatus("check-email");
      // Full reload so AppProvider re-initialises with the new session cookie
      // and the signed-in UI (avatar/profile) shows on the FIRST attempt.
      window.location.assign("/");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setStatus(error.message);
    // Full reload (not router.push) so the session is picked up immediately —
    // avoids the "have to sign in twice" propagation gap.
    if (data.session) window.location.assign("/");
  }

  // Send the user to the Sign-in tab when their email already has an account.
  function goToSignin() {
    setMode("signin");
    setPassword("");
    setStatus("exists");
  }

  async function sendReset(event) {
    event.preventDefault();
    if (!supabase) return setStatus(notConfigured);
    setStatus("loading");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`
    });
    setStatus(error ? error.message : "reset-sent");
  }

  async function resendConfirmation() {
    if (!supabase) return setStatus(notConfigured);
    setStatus("loading");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo }
    });
    setStatus(error ? error.message : "check-email");
  }

  const inputClass =
    "min-h-11 rounded-2xl border border-black/10 px-4 text-sm outline-none focus:border-wash-500";

  const heading = isReset
    ? "Reset your password"
    : isSignup
      ? "Create your account"
      : "Welcome back";
  const subheading = isReset
    ? "We'll email you a link to set a new password."
    : isSignup
      ? "Sign up to save your tokens, stamps and bookings."
      : "Sign in to your Washgo account.";

  return (
    <section className="grid h-full place-items-center bg-white px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl font-black">{heading}</h1>
        <p className="mt-2 text-sm text-neutral-600">{subheading}</p>

        {/* Mode toggle (hidden during password reset) */}
        {!isReset && (
          <div className="mt-6 inline-flex w-full rounded-full bg-neutral-100 p-1 text-sm font-bold">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className={`flex-1 rounded-full py-2 transition ${
                !isSignup ? "bg-white text-ink shadow" : "text-neutral-500"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`flex-1 rounded-full py-2 transition ${
                isSignup ? "bg-white text-ink shadow" : "text-neutral-500"
              }`}
            >
              Sign up
            </button>
          </div>
        )}

        {/* Account-exists notice after a blocked signup */}
        {status === "exists" && (
          <p className="mt-5 rounded-2xl bg-wash-50 px-4 py-3 text-sm text-ink">
            You already have an account with that email — please sign in.
          </p>
        )}

        {!isReset && (
          <>
            <Button variant="secondary" onClick={signInWithGoogle} className="mt-5 w-full">
              Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
              <span className="h-px flex-1 bg-black/10" />
              or
              <span className="h-px flex-1 bg-black/10" />
            </div>
          </>
        )}

        {status === "check-email" ? (
          <div className="grid gap-3">
            <p className="rounded-2xl bg-wash-50 px-4 py-3 text-sm text-ink">
              Almost there — check your inbox to confirm <strong>{email}</strong>,
              then sign in.
            </p>
            <button
              type="button"
              onClick={resendConfirmation}
              className="text-sm font-semibold text-wash-500"
            >
              Didn&apos;t get it? Resend confirmation email
            </button>
          </div>
        ) : status === "reset-sent" ? (
          <p className="rounded-2xl bg-wash-50 px-4 py-3 text-sm text-ink">
            Check your inbox — we sent a password reset link to{" "}
            <strong>{email}</strong>.
          </p>
        ) : isReset ? (
          <form onSubmit={sendReset} className="grid gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
            <Button type="submit" className="w-full" disabled={status === "loading"}>
              {status === "loading" ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-3">
            {isSignup && (
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className={inputClass}
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              className={inputClass}
            />
            <Button type="submit" className="w-full" disabled={status === "loading"}>
              {status === "loading"
                ? "Please wait…"
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>
        )}

        {/* Forgot-password link (sign-in only) */}
        {!isSignup && !isReset && status !== "reset-sent" && (
          <button
            type="button"
            onClick={() => switchMode("reset")}
            className="mt-3 text-sm font-semibold text-wash-500"
          >
            Forgot password?
          </button>
        )}

        {status &&
          !["loading", "check-email", "reset-sent", "exists"].includes(status) && (
            <p className="mt-3 text-sm text-red-600">{status}</p>
          )}

        <p className="mt-5 text-center text-sm text-neutral-500">
          {isReset ? (
            <>
              Remembered it?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-bold text-wash-500"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              {isSignup ? "Already have an account? " : "New to Washgo? "}
              <button
                type="button"
                onClick={() => switchMode(isSignup ? "signin" : "signup")}
                className="font-bold text-wash-500"
              >
                {isSignup ? "Sign in" : "Sign up"}
              </button>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
