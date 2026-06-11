"use client";

import { useRouter } from "next/navigation";
import { getVouchers } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";

export function VouchersScreen() {
  const router = useRouter();
  const { t, state, redeemVoucher } = useApp();
  const vouchers = getVouchers(state.voucher, t);
  // Redeeming the free-wash voucher arms it for the next booking; either way we
  // send the user to browse a shop where the voucher gets applied/used.
  const onUse = (voucher) => {
    if (voucher.id === "freewash") redeemVoucher();
    router.push("/explore");
  };

  return (
    <section className="h-full overflow-y-auto bg-white px-4 py-7 lg:bg-mist">
      <div className="mx-auto grid w-full max-w-2xl content-start gap-4">
      <TopBar compact title={t("currentVouchers")} subtitle={`${vouchers.length} ${t("voucherCount")}`} />
      <div className="grid gap-3 sm:grid-cols-2">
        {vouchers.map((voucher) => (
          <article
            key={voucher.id}
            className={`grid gap-3 overflow-hidden rounded-[18px] p-5 text-white ${
              voucher.tone === "green"
                ? "bg-[radial-gradient(circle_at_86%_20%,rgba(255,255,255,0.4),transparent_22%),linear-gradient(135deg,#9db000,#c4dc00_68%,#edff4a)]"
                : "bg-[radial-gradient(circle_at_88%_22%,rgba(255,255,255,0.35),transparent_22%),linear-gradient(135deg,#c40000,#ff1208_68%,#ff7568)]"
            }`}
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/20">
              <Icon name={voucher.id === "freewash" ? "Car" : "Gift"} className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-black">{voucher.title}</h2>
              <p className="mt-1 max-w-[270px] text-sm leading-snug text-white/85">{voucher.copy}</p>
            </div>
            <div className="grid gap-1 rounded-xl border border-dashed border-white/40 bg-white/10 p-3 text-xs">
              <span className="flex justify-between gap-3">{t("code")}: <strong>{voucher.code}</strong></span>
              <span className="flex justify-between gap-3">{t("expires")}: <strong>{voucher.expires}</strong></span>
            </div>
            <Button onClick={() => onUse(voucher)} variant="onColor" className="justify-self-start">
              {t("useNow")}
            </Button>
          </article>
        ))}
      </div>
      </div>
    </section>
  );
}
