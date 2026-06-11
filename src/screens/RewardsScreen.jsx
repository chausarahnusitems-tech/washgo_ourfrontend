"use client";

import { useRouter } from "next/navigation";
import { getVouchers } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";
import { RewardsCard } from "../components/RewardsCard.jsx";
import { VoucherAccess } from "./shared/VoucherAccess.jsx";

export function RewardsScreen() {
  const router = useRouter();
  const { t, state, redeemVoucher } = useApp();
  const onVouchers = () => router.push("/vouchers");
  const onUseVoucher = () => {
    redeemVoucher();
    router.push("/explore");
  };
  return (
    <section className="h-full overflow-y-auto bg-white px-4 py-7 lg:bg-mist">
      <div className="mx-auto grid w-full max-w-2xl content-start gap-4">
        <TopBar compact title={t("rewardsTitle")} subtitle={t("rewardsCopy")} />
        <RewardsCard stamps={state.stamps} voucher={state.voucher} t={t} onUse={onUseVoucher} />
        <VoucherAccess count={getVouchers(state.voucher, t).length} t={t} onClick={onVouchers} />
      </div>
    </section>
  );
}
