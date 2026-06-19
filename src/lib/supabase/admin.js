import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client for SERVER-ONLY contexts — the PayOS webhook and
// the checkout route's `payments` writes. This key BYPASSES Row Level Security,
// so it must never be imported into a "use client" module or shipped to the
// browser. Returns null when the key isn't configured yet (so the build/dev app
// keeps running before PayOS is wired up).
let adminClient;

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return adminClient;
}
