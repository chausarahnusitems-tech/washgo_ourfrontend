"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatVnd } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
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
  const { t, state, topUpFunds, requireAuth } = useApp();
  const [amount, setAmount] = useState(100000);
  const [custom, setCustom] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const onBack = useBackOr("/account");

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
    if (!valid || pending) return;
    if (requireAuth) {
      router.push("/login");
      return;
    }
    setError("");
    setPending(true);
    const ok = await topUpFunds(amount);
    if (ok) {
      router.push("/account");
      return;
    }
    setPending(false);
    setError("Top-up failed. Please try again.");
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

          {/* Payment method (fake) */}
          <section className="mt-5 rounded-xl border border-black/15 bg-white p-3">
            <h2 className="font-display text-base font-black">{t("paymentMethod")}</h2>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-wash-50 text-wash-500">
                <Icon name="WalletCards" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <strong className="block">{t("walletMethod")}</strong>
                <span className="block text-xs text-neutral-500">{t("demoTopUpNote")}</span>
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
          {error ? (
            <p aria-live="polite" className="mb-3 text-sm font-bold text-wash-500">
              {error}
            </p>
          ) : null}
          <Button onClick={onAdd} disabled={!valid || pending} className="min-h-[54px] w-full rounded-full">
            <Icon name="Plus" className="h-5 w-5" />
            {pending ? "..." : `${t("addFunds")} ${valid ? formatVnd(amount) : ""}`}
          </Button>
        </div>
      </footer>
    </div>
  );
}
