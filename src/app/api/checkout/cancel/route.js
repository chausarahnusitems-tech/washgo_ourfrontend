import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server.js";
import { createAdminClient } from "@/lib/supabase/admin.js";
import { cancelCheckout } from "@/lib/payments/provider.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// User aborted the hosted checkout. Best-effort: cancel the PayOS link, mark the
// payment cancelled, and release a still-pending booking so its slot frees up
// immediately (it would otherwise free after the 30-min hold anyway). The webhook
// remains the source of truth — this never marks anything paid.
export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ received: true });

  let orderCode;
  try {
    orderCode = Number((await req.json())?.orderCode);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!Number.isFinite(orderCode)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Scope to the caller's own payment row.
  const { data: payment } = await admin
    .from("payments")
    .select("id, user_id, kind, booking_id, status")
    .eq("order_code", orderCode)
    .maybeSingle();

  if (!payment || payment.user_id !== user.id || payment.status !== "created") {
    return NextResponse.json({ received: true });
  }

  await admin.from("payments").update({ status: "cancelled" }).eq("id", payment.id);
  if (payment.kind === "booking" && payment.booking_id) {
    await admin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", payment.booking_id)
      .eq("status", "pending_payment");
  }
  await cancelCheckout(orderCode);

  return NextResponse.json({ received: true });
}
