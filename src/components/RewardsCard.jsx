import { Button } from "./ui/Button.jsx";

const washProgressCarIcon = "/icons/wash-progress-car.svg";

export function RewardsCard({ stamps, voucher, t, onUse }) {
  const totalStamps = 5;

  return (
    <section className="rounded-xl border border-black/20 bg-white p-3">
      <div>
        <h2 className="font-display text-base font-black">{t("rewardsTitle")}</h2>
        <p className="mt-1 text-xs text-neutral-500">{t("rewardsCopy")}</p>
      </div>
      <div className="mt-4 overflow-visible pt-5">
        <div className="relative flex w-full max-w-[314px] items-center overflow-visible">
          <span className="absolute right-0 top-[-22px] whitespace-nowrap text-[11px] font-black text-[#F04242]">
            {t("freeWash")}!
          </span>
          {Array.from({ length: totalStamps }, (_, index) => {
            const isActive = index < stamps;

            return (
              <div key={index} className="flex shrink-0 items-center">
                <span
                  className="grid h-[34px] w-[34px] shrink-0 place-items-center overflow-hidden rounded-full"
                  aria-label={`${index + 1} / ${totalStamps}`}
                >
                  <img
                    src={washProgressCarIcon}
                    alt=""
                    className={`h-[34px] w-[34px] ${isActive ? "" : "grayscale brightness-[1.56]"}`}
                  />
                </span>
                {index < totalStamps - 1 ? (
                  <span
                    className={`mx-2 h-[2px] w-5 shrink-0 ${index < stamps ? "bg-[#F04242]" : "bg-[#9E9E9E]"}`}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        <strong className="text-xl text-[#F04242]">{stamps}</strong> / {totalStamps} {t("washesCompleted")}
      </p>
      {voucher ? (
        <article className="mt-4 overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_88%_22%,rgba(255,255,255,0.35),transparent_22%),linear-gradient(135deg,#9db000,#c4dc00_68%,#edff4a)] p-5 text-white">
          <span className="text-xs font-black uppercase">{t("freeWash")}</span>
          <h3 className="mt-1 font-display text-xl font-black">{t("voucherTitle")}</h3>
          <p className="mt-1 max-w-[230px] text-sm text-white/85">{t("voucherCopy")}</p>
          <Button onClick={onUse} variant="onColor" className="mt-4 min-h-9 px-4">
            {t("useVoucher")}
          </Button>
        </article>
      ) : (
        <p className="mt-4 border-t border-black/10 pt-3 text-xs text-neutral-500">{t("voucherLocked")}</p>
      )}
    </section>
  );
}
