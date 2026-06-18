"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getVouchers } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { Button } from "../components/ui/Button.jsx";
import { RewardsCard } from "../components/RewardsCard.jsx";
import { VoucherAccess } from "./shared/VoucherAccess.jsx";

export function RewardsScreen() {
  const router = useRouter();
  const { t, state, redeemVoucher, promo, applyPromo, clearPromo } = useApp();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const onVouchers = () => router.push("/vouchers");
  const onUseVoucher = () => {
    redeemVoucher();
    router.push("/explore");
  };

  const onApply = async () => {
    setBusy(true);
    setError(false);
    const ok = await applyPromo(code);
    if (!ok) setError(true);
    else setCode("");
    setBusy(false);
  };

  return (
    <section className="h-full overflow-y-auto bg-white px-4 py-7 lg:bg-mist">
      <div className="mx-auto grid w-full max-w-2xl content-start gap-4">
        <TopBar compact title={t("rewardsTitle")} subtitle={t("rewardsCopy")} />

        {/* Referral / promo code — prominent, above the wash rewards. An applied
            code carries through to checkout. */}
        <section className="rounded-xl border border-wash-300 bg-wash-50 p-4">
          <div className="flex items-center gap-2">
            <Icon name="Tag" className="h-5 w-5 text-wash-500" />
            <h2 className="font-display text-base font-black text-ink">{t("referralTitle")}</h2>
          </div>
          <p className="mt-1 text-xs text-neutral-600">{t("referralPitch")}</p>
          {promo ? (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm font-bold text-lime-700">
              <span className="inline-flex items-center gap-2">
                <Icon name="Check" className="h-4 w-4" />
                {promo.code} · {t("codeApplied")}
              </span>
              <button type="button" onClick={clearPromo} className="text-xs text-neutral-500 underline">
                {t("removeCode")}
              </button>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onApply();
                  }
                }}
                placeholder={t("promoPlaceholder")}
                className="min-h-11 flex-1 rounded-xl border border-black/10 bg-white px-3 uppercase outline-none placeholder:normal-case focus:ring-4 focus:ring-wash-500/20"
              />
              <Button onClick={onApply} disabled={busy || !code.trim()} className="min-h-11 px-4">
                {t("applyCode")}
              </Button>
            </div>
          )}
          {error ? <p className="mt-2 text-xs font-bold text-red-600">{t("invalidCode")}</p> : null}
        </section>

        <RewardsCard stamps={state.stamps} voucher={state.voucher} t={t} onUse={onUseVoucher} />
        <VoucherAccess count={getVouchers(state.voucher, t).length} t={t} onClick={onVouchers} />
      </div>
    </section>
  );
}
