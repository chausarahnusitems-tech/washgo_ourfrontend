import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin.js";
import { verifyWebhook } from "@/lib/payments/provider.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PayOS webhook — THE source of truth. The browser never confirms a payment;
// only a signature-verified event here moves money or flips a booking live.
//
// Design notes:
//  - Idempotency is keyed on the ORDER (one checkout = one logical payment), and
//    ONLY successful events claim it. A failure therefore never blocks a later
//    completing transfer on the same order from being fulfilled.
//  - The settlement RPCs are themselves idempotent on the payment row and
//    money-safe: settle_booking_payment delivers a fully-paid pending booking, or
//    else credits the captured amount to the payer's wallet (never "money taken,
//    nothing given"); settle_topup credits the amount actually received.
export async function POST(req) {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "payments_not_configured" }, { status: 503 });
  }

  // Raw body, then verify. An invalid signature is rejected (PayOS will retry).
  let event;
  try {
    const body = JSON.parse(await req.text());
    event = await verifyWebhook(body);
  } catch (error) {
    console.error("[washgo] payos webhook verify failed", error);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const orderKey = String(event.orderCode);

  try {
    const { data: payment } = await admin
      .from("payments")
      .select("id, user_id, kind, booking_id, amount, status")
      .eq("order_code", event.orderCode)
      .maybeSingle();

    // Unknown order (e.g. PayOS verification ping) or already settled — ack.
    if (!payment || payment.status === "paid") {
      return NextResponse.json({ received: true });
    }

    // Non-success: mark the payment failed and release a still-pending booking,
    // atomically, in one RPC. Not recorded as a settled event, so a later genuine
    // success on the same order can still be fulfilled (money-safely via settle_*).
    if (!event.success) {
      const { error } = await admin.rpc("mark_payment_failed", { p_payment_id: payment.id });
      if (error) throw error;
      return NextResponse.json({ received: true });
    }

    // Success: SETTLE FIRST, then record the audit/dedup row. Both settle RPCs
    // lock the payment row FOR UPDATE and early-return once it is 'paid', so they
    // are idempotent and serialize concurrent/duplicate deliveries. Settling
    // before recording means a crash between the two can NEVER strand captured
    // money — a retry simply re-runs the idempotent settle. (Recording first
    // risked a retry being deduped before the money was ever applied.)
    if (payment.kind === "topup") {
      // Credit the amount actually received (handles VietQR under/over-transfer).
      const { error } = await admin.rpc("settle_topup", {
        p_payment_id: payment.id,
        p_received: event.amount
      });
      if (error) throw error;
    } else if (payment.kind === "booking") {
      // Delivers if fully paid & still pending; otherwise credits the captured
      // amount to the payer's wallet (cancelled/late/underpaid) — never lost.
      const { error } = await admin.rpc("settle_booking_payment", {
        p_booking_id: payment.booking_id,
        p_payment_id: payment.id,
        p_received: event.amount
      });
      if (error) throw error;
    }

    // Best-effort audit/dedup log (unique on provider+order). A duplicate
    // delivery's unique-violation is harmless: the settle above was already
    // idempotent, and a redelivery short-circuits on payment.status='paid'.
    await admin.from("payment_events").insert({
      provider: event.provider,
      event_id: orderKey,
      type: "payment.succeeded",
      payload: event.raw
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[washgo] payos webhook fulfilment failed", error);
    return NextResponse.json({ error: "fulfilment_failed" }, { status: 500 });
  }
}
