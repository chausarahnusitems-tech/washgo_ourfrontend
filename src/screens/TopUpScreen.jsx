"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatVnd } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { devAddFunds, startCheckout } from "../lib/data/billing.js";
import { useBackOr } from "../lib/useBackOr.js";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";

// Local-only fake top-up. The amounts are preset VND chips plus a free-form
// entry; "Add Funds" just bumps the wallet balance in app state. A real payment
// flow will replace `topUpFunds` once the backend exists.
const presets = [50000, 100000, 200000, 500000, 1000000, 2000000];

export function TopUpScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, state, requireAuth, mode, topUpFunds, refreshAccount } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [devBusy, setDevBusy] = useState(false);
  // A booking that can't be afforded passes ?amount=<shortfall> so the user lands
  // on the exact top-up they need pre-filled (item 7).
  const presetAmount = Math.round(Number(searchParams.get("amount")) || 0);
  const hasPreset = presetAmount > 0;
  const [amount, setAmount] = useState(hasPreset ? presetAmount : 100000);
  const [custom, setCustom] = useState(hasPreset && !presets.includes(presetAmount) ? String(presetAmount) : "");

  // Where to return after a successful top-up. Defaults to the account page, but
  // the booking flow passes ?next=/shops/<id>/book so the user lands back on the
  // booking they couldn't afford, ready to confirm.
  const next = searchParams.get("next");
  const onBack = useBackOr(next || "/account");

  const onCustom = (value) => {
    const digits = value.replace(/[^\d]/g, "");
    setCustom(digits);
    setAmount(digits ? Number(digits) : 0);
  };

  const onPreset = (value) => {
    setAmount(value);
    setCustom("");
  };

  const valid = amount > 0;
  const newBalance = state.funds + (valid ? amount : 0);

  const onAdd = async () => {
    if (!valid || busy) return;
    if (requireAuth) {
      router.push("/login");
      return;
    }
    const returnTo = next || "/account";
    setBusy(true);
    setError("");

    // Demo: no gateway — bump the local balance and return.
    if (mode === "demo") {
      await topUpFunds(amount);
      router.push(returnTo);
      return;
    }

    // Backend: hand off to the hosted PayOS checkout. The webhook credits the
    // wallet; on success the browser redirects away (nothing below runs).
    const err = await startCheckout({ kind: "topup", amount, next: returnTo });
    if (err) {
      setBusy(false);
      setError(
        err === "payments_not_configured"
          ? "Payments aren't set up yet — please try again later."
          : "Couldn't start the payment. Please try again."
      );
    }
  };

  // Dev-only wallet unlock (see DEV_WALLET_UNLOCK). The button only renders on a
  // non-production build with the public flag set; the actual crediting is gated
  // AGAIN on the server (NODE_ENV + DEV_WALLET_UNLOCK + service-role-only RPC), so
  // it is never reachable in production and never exploitable by a customer.
  const devUnlocked =
    process.env.NEXT_PUBLIC_DEV_WALLET_UNLOCK === "true" &&
    process.env.NODE_ENV !== "production" &&
    mode === "backend";

  const onDevAdd = async () => {
    if (devBusy) return;
    if (requireAuth) {
      router.push("/login");
      return;
    }
    setDevBusy(true);
    setError("");
    const result = await devAddFunds();
    if (result.error) setError(`Dev top-up unavailable (${result.error}).`);
    else await refreshAccount();
    setDevBusy(false);
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[1fr_auto] bg-white lg:bg-mist">
      <section className="min-h-0 overflow-y-auto px-4 pb-4 pt-7">
        <div className="mx-auto w-full max-w-xl">
          <TopBar compact title={t("topUpFunds")} subtitle={t("topUpSubtitle")} onBack={onBack} />

          {/* Current balance */}
          <section className="overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_88%_22%,rgba(255,255,255,0.35),transparent_24%),linear-gradient(135deg,#c40000,#ff1208_68%,#ff7568)] p-6 text-white">
            <div className="flex items-center gap-2 text-sm text-white/90">
              <Icon name="Wallet" className="h-5 w-5" />
              <span>{t("currentBalance")}</span>
            </div>
            <strong className="mt-2 block font-display text-3xl font-black">{formatVnd(state.funds)}</strong>
          </section>

          {/* Preset amounts */}
          <section className="mt-5">
            <h2 className="font-display text-base font-black">{t("selectAmount")}</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {presets.map((value) => {
                const selected = !custom && amount === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onPreset(value)}
                    aria-pressed={selected}
                    className={`min-h-12 rounded-xl border text-sm font-black ${
                      selected ? "border-wash-500 bg-wash-500 text-white" : "border-black/15 bg-white text-ink"
                    }`}
                  >
                    {formatVnd(value)}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-bold text-neutral-500">{t("customAmount")}</span>
              <input
                inputMode="numeric"
                value={custom}
                onChange={(event) => onCustom(event.target.value)}
                placeholder="0"
                className="mt-1 min-h-12 w-full rounded-xl border border-black/10 bg-neutral-100 px-3 text-lg font-black outline-none focus:ring-4 focus:ring-wash-500/20"
              />
            </label>
          </section>

          {/* Payment method */}
          <section className="mt-5 rounded-xl border border-black/15 bg-white p-3">
            <h2 className="font-display text-base font-black">{t("paymentMethod")}</h2>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-wash-50 text-wash-500">
                <Icon name="WalletCards" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <strong className="block">
                  {mode === "demo" ? t("walletMethod") : "VietQR · bank · e-wallet"}
                </strong>
                <span className="block text-xs text-neutral-500">
                  {mode === "demo" ? t("demoTopUpNote") : "Secured by PayOS — pay by QR, bank app or e-wallet."}
                </span>
              </div>
            </div>
          </section>
        </div>
      </section>

      <footer className="border-t border-black/15 bg-white p-4">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-neutral-500">{t("newBalance")}</span>
            <strong className="font-display text-lg font-black text-wash-500">{formatVnd(newBalance)}</strong>
          </div>
          {error ? <p className="mb-3 text-sm font-bold text-wash-500">{error}</p> : null}
          <Button onClick={onAdd} disabled={!valid || busy} className="min-h-[54px] w-full rounded-full">
            <Icon name="Plus" className="h-5 w-5" />
            {busy ? "…" : `${t("addFunds")} ${valid ? formatVnd(amount) : ""}`}
          </Button>
          {devUnlocked && (
            <button
              type="button"
              onClick={onDevAdd}
              disabled={devBusy}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-dashed border-amber-400 bg-amber-50 text-sm font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
            >
              🔧 {devBusy ? "Adding…" : `Dev: add ${formatVnd(1000000000)}`}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
