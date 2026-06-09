import { plans } from "../data/catalog.js";
import { Button, IconButton } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";

export function PlansScreen({ state, t, onLang, onBack, onSelectPlan, onContinue }) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[1fr_auto] bg-white lg:bg-mist">
      <section className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-7">
        <div className="mx-auto w-full max-w-xl">
        <div className="mb-7 grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-3 lg:hidden">
          <IconButton label={t("back")} onClick={onBack}>
            <Icon name="ArrowLeft" className="h-5 w-5" />
          </IconButton>
          <div className="min-w-0">
            <h1 className="m-0 font-display text-[1.35rem] font-black leading-none text-ink">{t("choosePlan")}</h1>
          </div>
          <div className="inline-flex h-9 shrink-0 rounded-full bg-neutral-100 p-1" role="group" aria-label="Language">
            {["en", "vi"].map((code) => (
              <button
                key={code}
                type="button"
                data-lang={code}
                onClick={() => onLang(code)}
                className={`min-w-8 rounded-full px-2 text-[0.68rem] font-black ${
                  state.lang === code ? "bg-ink text-white" : "text-neutral-500"
                }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-2 hidden items-center gap-3 lg:flex">
          <IconButton label={t("back")} variant="secondary" onClick={onBack}>
            <Icon name="ArrowLeft" className="h-5 w-5" />
          </IconButton>
          <h1 className="font-display text-2xl font-black">{t("choosePlan")}</h1>
        </div>
        <div className="mt-7 grid gap-5">
          {plans.map((plan) => {
            const selected = state.selectedPlan === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => onSelectPlan(plan.id)}
                aria-pressed={selected}
                className={`relative grid min-h-[124px] min-w-0 grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 rounded-[22px] border-2 p-5 text-left ${
                  selected ? "border-wash-500 bg-wash-50" : "border-neutral-100 bg-white"
                }`}
              >
                {plan.badge ? (
                  <span className="absolute -top-3 right-5 rounded-full bg-wash-500 px-3 py-1.5 text-xs font-black text-white">
                    {t("bestValue")}
                  </span>
                ) : null}
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full border-2 ${
                    selected ? "border-wash-500 bg-wash-500 text-white" : "border-ink"
                  }`}
                >
                  {selected ? <Icon name="Check" className="h-3.5 w-3.5" /> : null}
                </span>
                <span>
                  <strong className="block font-display text-xl font-black">{plan.id === "basic" ? t("basic") : t("premium")}</strong>
                  <span className="mt-3 block text-sm text-neutral-500">{plan.id === "basic" ? t("basicPerk") : t("premiumPerk")}</span>
                  {plan.id === "premium" ? <span className="mt-2 block text-sm text-neutral-500">{t("premiumExtra")}</span> : null}
                </span>
                <span className="text-right">
                  <strong className="block text-lg font-black">{plan.price}</strong>
                  <small className="text-neutral-500">{t("month")}</small>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mx-9 mt-9 grid gap-5">
          <div className="grid grid-cols-[24px_1fr] items-center gap-3">
            <Icon name="ShieldCheck" className="h-5 w-5" />
            <strong className="text-sm">{t("trustPlan")}</strong>
          </div>
          <div className="grid grid-cols-[24px_1fr] items-center gap-3">
            <Icon name="WalletCards" className="h-5 w-5" />
            <strong className="text-sm">{t("guarantee")}</strong>
          </div>
        </div>
        </div>
      </section>
      <footer className="border-t border-black/20 bg-white p-4">
        <div className="mx-auto w-full max-w-xl">
          <Button onClick={onContinue} className="w-full rounded-2xl">
            {t("continue")}
          </Button>
        </div>
      </footer>
    </div>
  );
}
