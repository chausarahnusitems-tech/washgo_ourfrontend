import { getPayos } from "../payos/server.js";

// Normalized payment-provider adapter. Today the only provider is PayOS; VNPAY /
// MoMo can be added later by branching here, without touching the route handlers
// that call createCheckout / verifyWebhook / cancelCheckout.

const CHECKOUT_EXPIRY_SECONDS = 30 * 60; // mirrors the 30-min slot hold in SQL

export function paymentsConfigured() {
  return Boolean(getPayos());
}

// Create a hosted checkout (PayOS payment link). Returns the URL to redirect the
// browser to, plus the provider's link id for reconciliation.
export async function createCheckout({ orderCode, amount, description, returnUrl, cancelUrl }) {
  const payos = getPayos();
  if (!payos) throw new Error("payments_not_configured");
  const res = await payos.paymentRequests.create({
    orderCode,
    amount,
    // PayOS caps the description (VietQR transfer content) at 25 chars.
    description: String(description).slice(0, 25),
    returnUrl,
    cancelUrl,
    expiredAt: Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRY_SECONDS
  });
  return { checkoutUrl: res.checkoutUrl, paymentLinkId: res.paymentLinkId };
}

// Verify an inbound webhook. Throws if the signature is invalid (so the caller
// returns a non-2xx and PayOS retries). Returns a normalized result.
export async function verifyWebhook(body) {
  const payos = getPayos();
  if (!payos) throw new Error("payments_not_configured");
  const data = await payos.webhooks.verify(body);
  return {
    provider: "payos",
    // `reference` is the unique bank-transaction id; fall back to orderCode.
    eventId: String(data.reference ?? data.orderCode),
    orderCode: data.orderCode,
    amount: data.amount,
    // PayOS signals a successful transaction with code "00".
    success: data.code === "00",
    raw: data
  };
}

// Best-effort cancel of an abandoned payment link (called when a pending booking
// is released). Safe to ignore failures — the link may already be expired/paid.
export async function cancelCheckout(orderCode, reason = "Cancelled by user") {
  const payos = getPayos();
  if (!payos) return;
  try {
    await payos.paymentRequests.cancel(orderCode, reason);
  } catch {
    /* no-op */
  }
}
