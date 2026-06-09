import { images } from "../assets.js";
import { useIsDesktop } from "../lib/useIsDesktop.js";
import { TopBar } from "../components/layout/TopBar.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { RewardsCard } from "../components/RewardsCard.jsx";
import { VoucherAccess } from "./shared/VoucherAccess.jsx";

export function AccountScreen(props) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <AccountDesktop {...props} /> : <AccountMobile {...props} />;
}

/* ------------------------------------------------------------------ */
/* Mobile (original)                                                   */
/* ------------------------------------------------------------------ */
function AccountMobile({ state, t, onLang, onHome, onPlans, onVouchers, onReset }) {
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

/* ------------------------------------------------------------------ */
/* Desktop two-column (image 4)                                        */
/* ------------------------------------------------------------------ */
function RewardTile({ title, expires, tone, t }) {
  const toneClasses =
    tone === "green"
      ? "bg-[radial-gradient(circle_at_86%_20%,rgba(255,255,255,0.4),transparent_24%),linear-gradient(135deg,#7f9b1e,#a7c400_70%,#c9e84a)]"
      : "bg-[radial-gradient(circle_at_88%_22%,rgba(255,255,255,0.35),transparent_24%),linear-gradient(135deg,#c40000,#ff1208_68%,#ff7568)]";

  return (
    <article className={`relative flex h-40 flex-col justify-between overflow-hidden rounded-[18px] p-5 text-white ${toneClasses}`}>
      <h3 className="font-display text-2xl font-black">{title}</h3>
      <p className="text-sm text-white/90">
        {t("expires")}
        <br />
        <strong>{t("dateUntil")}</strong>
      </p>
    </article>
  );
}

function AccountDesktop({ state, t, onHome, onPlans, onReset }) {
  return (
    <section className="h-full overflow-y-auto bg-mist">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[340px_1fr] gap-6 px-6 py-8 xl:px-10">
        {/* Left: profile */}
        <aside className="flex flex-col gap-4">
          <div className="flex flex-col items-center rounded-2xl border border-black/10 bg-white p-6 text-center">
            <img src={images.profile} alt={t("profileName")} className="h-24 w-24 rounded-full object-cover" />
            <h1 className="mt-4 font-display text-xl font-black">{t("profileName")}</h1>
            <p className="mt-1 text-sm text-neutral-500">{t("memberSince")}</p>

            <div className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl bg-wash-50 p-4">
              <div className="text-left">
                <span className="block text-sm text-neutral-600">{t("myTokens")}</span>
                <strong className="block text-2xl font-black">{state.tokens}</strong>
              </div>
              <Button onClick={onPlans} className="min-h-9 px-4 text-sm">{t("upgradePlan")}</Button>
            </div>
          </div>
          <Button variant="secondary" onClick={onReset}>{t("resetDemo")}</Button>
        </aside>

        {/* Right: membership + rewards */}
        <div className="flex flex-col gap-6">
          <section className="relative min-h-[150px] overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_88%_20%,rgba(255,255,255,0.3),transparent_30%),linear-gradient(135deg,#9c0000,#c40000_60%,#ff5a4a)] p-7 text-white">
            <h2 className="font-display text-2xl font-black">{t("proMember")}</h2>
            <p className="mt-3 text-sm text-white/90">
              {t("renewOn")}
              <br />
              <strong>{t("dateUntil")}</strong>
            </p>
            <p className="mt-3 text-sm text-white/90">{t("unlimitedWashes")}</p>
          </section>

          <RewardsCard stamps={state.stamps} voucher={state.voucher} t={t} onUse={onHome} />

          <section>
            <h2 className="font-display text-lg font-black">{t("rewards")}</h2>
            <div className="mt-3 grid grid-cols-2 gap-5">
              <RewardTile title={t("freeCharging")} tone="green" t={t} />
              <RewardTile title={t("discountDetailing")} tone="red" t={t} />
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
