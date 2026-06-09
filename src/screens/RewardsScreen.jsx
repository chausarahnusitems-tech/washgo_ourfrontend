import { TopBar } from "../components/layout/TopBar.jsx";
import { RewardsCard } from "../components/RewardsCard.jsx";
import { VoucherAccess } from "./shared/VoucherAccess.jsx";

export function RewardsScreen({ state, t, onLang, onHome, onVouchers }) {
  return (
    <section className="h-full overflow-y-auto bg-white px-4 py-7 lg:bg-mist">
      <div className="mx-auto grid w-full max-w-2xl content-start gap-4">
        <TopBar compact title={t("rewardsTitle")} subtitle={t("rewardsCopy")} t={t} lang={state.lang} onLang={onLang} onHome={onHome} />
        <RewardsCard stamps={state.stamps} voucher={state.voucher} t={t} onUse={onHome} />
        <VoucherAccess count={state.voucher ? 2 : 1} t={t} onClick={onVouchers} />
      </div>
    </section>
  );
}
