"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../lib/AppContext.jsx";
import { formatVnd } from "../lib/booking.js";
import { useBackOr } from "../lib/useBackOr.js";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";

// Placeholder card-payment page. PURELY a mock — the card details are validated
// for shape only and NEVER sent anywhere (no Stripe / PSP). On "Pay" it performs
// the underlying wallet action (top-up or membership) and returns to `next`.
export function PaymentScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, requireAuth, topUpFunds, startMembership } = useApp();

  const purpose = searchParams.get("purpose") === "membership" ? "membership" : "topup";
  const amount = Math.max(0, Math.round(Number(searchParams.get("amount") || 0)));
  const next = searchParams.get("next") || "/account";
  const onBack = useBackOr(next);

  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const digits = card.replace(/\D/g, "");
  const validCard = digits.length >= 15 && digits.length <= 19;
  const validExpiry = /^\d{2}\/\d{2}$/.test(expiry);
  const validCvc = /^\d{3,4}$/.test(cvc);
  const valid = validCard && validExpiry && validCvc && name.trim().length > 1;

  function formatCard(value) {
    return value
      .replace(/\D/g, "")
      .slice(0, 19)
      .replace(/(.{4})/g, "$1 ")
      .trim();
  }
  function formatExpiry(value) {
    const d = value.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }

  async function onPay() {
    if (!valid || pending) return;
    if (requireAuth) {
      router.push("/login");
      return;
    }
    setError("");
    setPending(true);
    // Simulate processing latency-free; perform the real wallet action.
    const ok = purpose === "membership" ? await startMembership() : await topUpFunds(amount);
    if (ok) {
      router.push(next);
      return;
    }
    setPending(false);
    setError(
      purpose === "membership"
        ? "Couldn't start membership — check your wallet balance."
        : "Payment failed. Please try again."
    );
  }

  const title = purpose === "membership" ? t("payMembership") : t("payTopUp");
  const inputClass =
    "min-h-12 w-full rounded-2xl border border-black/10 px-4 text-sm outline-none focus:border-wash-500";

  return (
    <div className="grid h-full min-h-0 grid-rows-[1fr_auto] bg-white lg:bg-mist">
      <section className="min-h-0 overflow-y-auto px-4 pb-4 pt-7">
        <div className="mx-auto w-full max-w-md">
          <TopBar compact title={title} onBack={onBack} />

          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Icon name="ShieldCheck" className="h-4 w-4" />
            {t("paymentDemoNote")}
          </div>

          <div className="mt-5 overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#1f1f1f,#3a3a3a)] p-6 text-white">
            <div className="flex items-center justify-between">
              <Icon name="WalletCards" className="h-7 w-7" />
              <span className="text-sm text-white/70">{purpose === "membership" ? t("membership") : t("wallet")}</span>
            </div>
            <p className="mt-6 font-mono text-lg tracking-widest">{card || "•••• •••• •••• ••••"}</p>
            <div className="mt-3 flex justify-between text-xs text-white/70">
              <span>{name || t("cardName")}</span>
              <span>{expiry || "MM/YY"}</span>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-bold text-neutral-500">{t("cardNumber")}</span>
              <input
                inputMode="numeric"
                value={card}
                onChange={(e) => setCard(formatCard(e.target.value))}
                placeholder="4242 4242 4242 4242"
                className={inputClass}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-bold text-neutral-500">{t("cardName")}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="A. Driver" className={inputClass} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-bold text-neutral-500">{t("expiry")}</span>
                <input
                  inputMode="numeric"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-bold text-neutral-500">CVC</span>
                <input
                  inputMode="numeric"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="123"
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/15 bg-white p-4">
        <div className="mx-auto w-full max-w-md">
          {error ? <p className="mb-3 text-sm font-bold text-wash-500">{error}</p> : null}
          <Button onClick={onPay} disabled={!valid || pending} className="min-h-[54px] w-full rounded-full">
            <Icon name="ShieldCheck" className="h-5 w-5" />
            {pending ? "…" : `${t("pay")} ${amount ? formatVnd(amount) : ""}`}
          </Button>
        </div>
      </footer>
    </div>
  );
}
