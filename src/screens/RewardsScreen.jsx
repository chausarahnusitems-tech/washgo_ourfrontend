import { TopBar } from "../components/layout/TopBar.jsx";
import { RewardsCard } from "../components/RewardsCard.jsx";
import { VoucherAccess } from "./shared/VoucherAccess.jsx";

export function RewardsScreen({ state, t, onLang, onHome, onVouchers }) {
  return (
    <section className="grid h-full content-start gap-4 overflow-y-auto bg-white px-4 py-7">
      <TopBar compact title={t("rewardsTitle")} subtitle={t("rewardsCopy")} t={t} lang={state.lang} onLang={onLang} onHome={onHome} />
      <RewardsCard stamps={state.stamps} voucher={state.voucher} t={t} onUse={onHome} />
      <VoucherAccess count={state.voucher ? 2 : 1} t={t} onClick={onVouchers} />
    </section>
  );
}
