import { images } from "../assets.js";
import { TopBar } from "../components/layout/TopBar.jsx";
import { Button } from "../components/ui/Button.jsx";
import { RewardsCard } from "../components/RewardsCard.jsx";
import { VoucherAccess } from "./shared/VoucherAccess.jsx";

export function AccountScreen({ state, t, onLang, onHome, onPlans, onVouchers, onReset }) {
  return (
    <section className="grid h-full content-start gap-4 overflow-y-auto bg-white px-4 py-7">
      <TopBar compact title={t("account")} t={t} lang={state.lang} onLang={onLang} onHome={onHome} />
      <div className="flex items-center gap-3">
        <img src={images.profile} alt={t("profileName")} className="h-16 w-16 rounded-full object-cover" />
        <div>
          <h1 className="font-display text-2xl font-black">{t("profileName")}</h1>
          <p className="mt-1 text-sm text-neutral-600">{t("memberSince")}</p>
        </div>
      </div>
      <section className="min-h-[154px] rounded-[18px] bg-[radial-gradient(circle_at_88%_22%,rgba(255,255,255,0.35),transparent_22%),linear-gradient(135deg,#c40000,#ff1208_68%,#ff7568)] p-6 text-white">
        <h2 className="font-display text-2xl font-black">{state.selectedPlan === "premium" ? t("premium") : t("basic")} Member</h2>
        <p className="mt-3 text-sm text-white/90">
          {t("memberUntil")}
          <br />
          <strong>{t("dateUntil")}</strong>
        </p>
      </section>
      <section className="flex min-h-[94px] items-center justify-between gap-4 rounded-xl border border-black/20 bg-white px-6 py-5">
        <div>
          <span className="text-neutral-600">{t("myTokens")}</span>
          <strong className="block text-2xl">{state.tokens}</strong>
        </div>
        <Button onClick={onPlans} className="min-h-9 px-4 text-sm">{t("upgradePlan")}</Button>
      </section>
      <VoucherAccess count={state.voucher ? 2 : 1} t={t} onClick={onVouchers} />
      <RewardsCard stamps={state.stamps} voucher={state.voucher} t={t} onUse={onHome} />
      <Button variant="secondary" onClick={onReset}>{t("resetDemo")}</Button>
    </section>
  );
}
