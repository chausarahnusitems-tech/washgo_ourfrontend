"use client";

// Client-side entry to the hosted PayOS checkout. The browser sends only the
// INTENT (kind + which booking/amount); the server route computes the real amount
// and creates the gateway session, then we redirect to the hosted page. Keeps the
// frontend "dumb": it never sends prices, discounts or reward math.
//
// Returns an error string on failure; on success the browser navigates away and
// nothing after the redirect runs.
export async function startCheckout(payload) {
  try {
    const res = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) return data.error || "checkout_failed";
    window.location.href = data.url;
    return null;
  } catch {
    return "checkout_failed";
  }
}

// Tell the server the user aborted, so it can release the held slot / cancel the
// PayOS link immediately. Best-effort — failures are ignored.
export async function abortCheckout(orderCode) {
  if (!orderCode) return;
  try {
    await fetch("/api/checkout/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderCode })
    });
  } catch {
    /* ignore */
  }
}
