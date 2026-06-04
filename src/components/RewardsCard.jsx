import { Icon } from "./ui/Icon.jsx";
import { Button } from "./ui/Button.jsx";

export function RewardsCard({ stamps, voucher, t, onUse }) {
  return (
    <section className="rounded-xl border border-black/20 bg-white p-3">
      <div>
        <h2 className="font-display text-base font-black">{t("rewardsTitle")}</h2>
        <p className="mt-1 text-xs text-neutral-500">{t("rewardsCopy")}</p>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className={`grid h-10 place-items-center rounded-full text-white ${index < stamps ? "bg-wash-500" : "bg-neutral-300"}`}
          >
            <Icon name="Car" className="h-5 w-5" />
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        <strong className="text-xl text-wash-500">{stamps}</strong> / 5 {t("washesCompleted")}
      </p>
      {voucher ? (
        <article className="mt-4 overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_88%_22%,rgba(255,255,255,0.35),transparent_22%),linear-gradient(135deg,#9db000,#c4dc00_68%,#edff4a)] p-5 text-white">
          <span className="text-xs font-black uppercase">{t("freeWash")}</span>
          <h3 className="mt-1 font-display text-xl font-black">{t("voucherTitle")}</h3>
          <p className="mt-1 max-w-[230px] text-sm text-white/85">{t("voucherCopy")}</p>
          <Button onClick={onUse} className="mt-4 min-h-9 bg-white px-4 text-wash-500 shadow-none hover:bg-white">
            {t("useVoucher")}
          </Button>
        </article>
      ) : (
        <p className="mt-4 border-t border-black/10 pt-3 text-xs text-neutral-500">{t("voucherLocked")}</p>
      )}
    </section>
  );
}
