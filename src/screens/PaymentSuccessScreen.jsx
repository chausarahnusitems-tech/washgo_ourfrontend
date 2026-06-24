"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../lib/AppContext.jsx";
import { createClient } from "../lib/supabase/client.js";
import { safeNextPath } from "../lib/safeNext.js";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";

// Post-checkout landing. This page is "nice UI only" — it NEVER marks anything
// paid. The PayOS webhook is the source of truth; here we just poll our own
// payments row until the webhook has flipped it to `paid`, then refresh the
// account and move the user on.
export function PaymentSuccessScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshAccount } = useApp();
  const supabase = useMemo(() => createClient(), []);

  const kind = params.get("kind");
  const orderCode = params.get("orderCode");
  // Sanitize the redirect target — never navigate off-origin from a URL param.
  const next = safeNextPath(params.get("next"));

  // checking -> spinner; paid -> brief tick then redirect; pending -> still
  // confirming; failed -> not completed.
  const [phase, setPhase] = useState("checking");
  const settled = useRef(false);

  const onward = () => {
    if (kind === "booking") return "/bookings";
    return next || "/account";
  };

  useEffect(() => {
    if (!supabase || !orderCode) {
      setPhase("pending");
      return undefined;
    }
    let active = true;
    let timer;
    let attempts = 0;
    const maxAttempts = 15; // ~23s

    async function settleAndGo() {
      if (settled.current) return;
      settled.current = true;
      await refreshAccount();
      if (!active) return;
      setPhase("paid");
      timer = setTimeout(() => router.replace(onward()), 900);
    }

    const tick = async () => {
      attempts += 1;
      try {
        const { data } = await supabase
          .from("payments")
          .select("status")
          .eq("order_code", Number(orderCode))
          .maybeSingle();
        if (data?.status === "paid") return settleAndGo();
        if (["failed", "cancelled", "expired"].includes(data?.status)) {
          if (active) setPhase("failed");
          return;
        }
      } catch {
        /* keep polling */
      }
      if (attempts >= maxAttempts) {
        if (active) setPhase("pending");
        return;
      }
      timer = setTimeout(tick, 1500);
    };

    timer = setTimeout(tick, 700);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, orderCode]);

  return (
    <section className="grid h-full place-items-center bg-white px-6 lg:bg-mist">
      <div className="w-full max-w-sm text-center">
        {phase === "checking" ? (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-wash-50 text-wash-500">
              <Icon name="RotateCcw" className="h-8 w-8 animate-spin" />
            </div>
            <h1 className="mt-5 font-display text-xl font-black">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Hang tight — we&apos;re verifying the transaction with PayOS.
            </p>
          </>
        ) : null}

        {phase === "paid" ? (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-wash-500 text-white">
              <Icon name="Check" className="h-8 w-8" />
            </div>
            <h1 className="mt-5 font-display text-2xl font-black">Payment confirmed</h1>
            <p className="mt-2 text-sm text-neutral-500">Taking you back…</p>
          </>
        ) : null}

        {phase === "pending" ? (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-50 text-amber-600">
              <Icon name="Clock" className="h-8 w-8" />
            </div>
            <h1 className="mt-5 font-display text-xl font-black">Still confirming</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Your payment is being processed. Your account will update automatically once
              it&apos;s confirmed — this can take a moment.
            </p>
            <Button onClick={() => router.replace(onward())} className="mt-6 w-full rounded-full">
              Continue
            </Button>
          </>
        ) : null}

        {phase === "failed" ? (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50 text-red-600">
              <Icon name="TriangleAlert" className="h-8 w-8" />
            </div>
            <h1 className="mt-5 font-display text-xl font-black">Payment not completed</h1>
            <p className="mt-2 text-sm text-neutral-500">
              No charge was confirmed. You can try again.
            </p>
            <Button onClick={() => router.replace(next || "/account")} className="mt-6 w-full rounded-full">
              Back
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}
