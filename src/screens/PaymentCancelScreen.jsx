"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { abortCheckout } from "../lib/data/billing.js";
import { safeNextPath } from "../lib/safeNext.js";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";

// User backed out of the hosted checkout. Release the held slot / cancel the
// PayOS link (best-effort), then offer to try again or go back.
export function PaymentCancelScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const orderCode = params.get("orderCode");
  // Sanitize the redirect target — never navigate off-origin from a URL param.
  const next = safeNextPath(params.get("next"));
  const released = useRef(false);

  useEffect(() => {
    if (released.current) return;
    released.current = true;
    abortCheckout(orderCode);
  }, [orderCode]);

  return (
    <section className="grid h-full place-items-center bg-white px-6 lg:bg-mist">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-neutral-100 text-neutral-500">
          <Icon name="X" className="h-8 w-8" />
        </div>
        <h1 className="mt-5 font-display text-xl font-black">Payment cancelled</h1>
        <p className="mt-2 text-sm text-neutral-500">No charge was made. You can try again anytime.</p>
        <div className="mt-6 grid gap-3">
          <Button onClick={() => router.replace(next || "/account")} className="w-full rounded-full">
            {next ? "Try again" : "Back to account"}
          </Button>
          <Button variant="secondary" onClick={() => router.replace("/")}>
            Go home
          </Button>
        </div>
      </div>
    </section>
  );
}
