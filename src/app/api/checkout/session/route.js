import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server.js";
import { createAdminClient } from "@/lib/supabase/admin.js";
import { createCheckout, paymentsConfigured } from "@/lib/payments/provider.js";
import { safeNextPath } from "@/lib/safeNext.js";

// PayOS SDK + service role + outbound HTTP: must run on Node, never statically
// rendered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOPUP = 100000000; // matches the top_up_for amount guard

function siteUrl(req) {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
}

export async function POST(req) {
  if (!paymentsConfigured()) {
    return NextResponse.json({ error: "payments_not_configured" }, { status: 503 });
  }

  // Identify the signed-in user from the cookie session (so the server-side
  // create_pending_booking runs as them and we tie payments to a real user).
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "payments_not_configured" }, { status: 503 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const site = siteUrl(req);
  const kind = body?.kind;
  const next = safeNextPath(body?.next);
  const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";

  try {
    if (kind === "topup") {
      const amount = Math.round(Number(body.amount));
      if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TOPUP) {
        return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
      }

      const { data: payment, error: insErr } = await admin
        .from("payments")
        .insert({ user_id: user.id, kind: "topup", amount, status: "created" })
        .select("id, order_code")
        .single();
      if (insErr) throw insErr;

      const returnUrl = `${site}/payment/success?kind=topup&orderCode=${payment.order_code}${nextParam}`;
      const cancelUrl = `${site}/payment/cancel?kind=topup&orderCode=${payment.order_code}${nextParam}`;
      let checkoutUrl, paymentLinkId;
      try {
        ({ checkoutUrl, paymentLinkId } = await createCheckout({
          orderCode: Number(payment.order_code),
          amount,
          description: "WashGo topup",
          returnUrl,
          cancelUrl
        }));
      } catch (e) {
        // The gateway never created a link → no payment can ever arrive. Don't
        // leave an orphaned 'created' row dangling.
        await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
        console.error("[washgo] payos createCheckout (topup) failed", e);
        return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
      }

      await admin
        .from("payments")
        .update({ payos_payment_link_id: paymentLinkId, checkout_url: checkoutUrl })
        .eq("id", payment.id);

      return NextResponse.json({ url: checkoutUrl });
    }

    if (kind === "booking") {
      // Create the booking as pending_payment (server-side pricing + validation)
      // AS THE USER, so RLS/auth.uid() apply exactly like the wallet path.
      const { data: pending, error: rpcErr } = await supabase.rpc("create_pending_booking", {
        p_shop_id: body.shopId,
        p_date: body.date,
        p_slot: body.slot,
        p_service_ids: body.serviceIds,
        p_coupon_code: body.couponCode || null,
        p_expected_plate: body.expectedPlate || null
      });
      if (rpcErr) {
        // Domain-level validation failure (slot full, coupon used, closed, …).
        // Return a stable machine code; keep the real reason server-side only.
        console.error("[washgo] create_pending_booking failed", rpcErr);
        return NextResponse.json({ error: "booking_unavailable" }, { status: 400 });
      }
      const bookingId = pending.booking_id;
      const amount = pending.amount;

      const { data: payment, error: insErr } = await admin
        .from("payments")
        .insert({
          user_id: user.id,
          kind: "booking",
          booking_id: bookingId,
          amount,
          status: "created"
        })
        .select("id, order_code")
        .single();
      if (insErr) throw insErr;

      const q = `kind=booking&orderCode=${payment.order_code}&bookingId=${bookingId}${nextParam}`;
      let checkoutUrl, paymentLinkId;
      try {
        ({ checkoutUrl, paymentLinkId } = await createCheckout({
          orderCode: Number(payment.order_code),
          amount,
          description: "WashGo booking",
          returnUrl: `${site}/payment/success?${q}`,
          cancelUrl: `${site}/payment/cancel?${q}`
        }));
      } catch (e) {
        // The gateway never created a link → no payment can arrive. Fail the
        // payment and release the pending hold so the slot frees immediately.
        await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
        await admin
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("id", bookingId)
          .eq("status", "pending_payment");
        console.error("[washgo] payos createCheckout (booking) failed", e);
        return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
      }

      await admin
        .from("payments")
        .update({ payos_payment_link_id: paymentLinkId, checkout_url: checkoutUrl })
        .eq("id", payment.id);

      return NextResponse.json({ url: checkoutUrl });
    }

    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  } catch (error) {
    console.error("[washgo] create checkout session failed", error);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
