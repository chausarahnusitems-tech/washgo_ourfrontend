import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server.js";
import { createAdminClient } from "@/lib/supabase/admin.js";

// DEV-ONLY wallet top-up. Uses the service-role key, so it must run on Node and
// never be statically rendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_AMOUNT = 1000000000; // 1,000,000,000 VND — effectively unlimited
const MAX_AMOUNT = 2000000000; // int4 ceiling guard (matches dev_add_funds cap)

// The endpoint is live ONLY on a local/dev server with the explicit opt-in flag.
//
//   * NODE_ENV is forced to 'production' in any real build/deploy (next build /
//     next start / Vercel), so this is the HARD wall: the route 404s in
//     production no matter what else is configured. A customer cannot change it.
//   * DEV_WALLET_UNLOCK is a NON-public env var (no NEXT_PUBLIC_ prefix), so it
//     never reaches the browser — a customer can neither see nor set it.
//
// Together with dev_add_funds being service-role-only, there is no single
// misconfiguration that lets a customer mint funds.
function devUnlocked() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_WALLET_UNLOCK === "true";
}

export async function POST(req) {
  // 404 (not 403) so a locked deployment looks like the route simply doesn't exist.
  if (!devUnlocked()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Credit ONLY the signed-in caller — never a user id taken from the request body.
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "service_role_missing" }, { status: 503 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    // Empty/invalid body is fine — fall back to the default amount.
  }
  let amount = Math.round(Number(body?.amount));
  if (!Number.isFinite(amount) || amount <= 0) amount = DEFAULT_AMOUNT;
  amount = Math.min(amount, MAX_AMOUNT);

  const { data: funds, error } = await admin.rpc("dev_add_funds", {
    p_user_id: user.id,
    p_amount: amount,
    p_note: "Dev wallet unlock"
  });
  if (error) {
    console.error("[washgo] dev_add_funds failed", error);
    return NextResponse.json({ error: "dev_topup_failed" }, { status: 500 });
  }

  return NextResponse.json({ funds });
}
