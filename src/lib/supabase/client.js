"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Safe to call from "use client" components.
// Reads the public anon key — Row Level Security protects the data, not secrecy
// of this key.
//
// Returns `null` when env vars are absent so the app still runs in demo mode
// (signed-out) instead of crashing before Supabase is configured.
//
// IMPORTANT: this is a singleton. Every caller must share ONE client instance,
// otherwise a sign-in on one instance won't fire onAuthStateChange on another
// (which caused "have to sign in twice" before the session propagated).
let browserClient;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!browserClient) browserClient = createBrowserClient(url, key);
  return browserClient;
}
