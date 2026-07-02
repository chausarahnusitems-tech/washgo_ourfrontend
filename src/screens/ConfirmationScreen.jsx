"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatVnd, getCurrentShop } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { Button, IconButton } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { RewardsCard } from "../components/RewardsCard.jsx";
import { BookingCard } from "./shared/BookingCard.jsx";

export function ConfirmationScreen() {
  const router = useRouter();
  const { t, state, hydrated, redeemVoucher } = useApp();
  const shop = getCurrentShop(state.booking?.shopId);
  const onBookings = () => router.push("/bookings");
  const onHome = () => router.push("/");
  const onUseVoucher = () => {
    redeemVoucher();
    router.push("/explore");
  };

  // Reaching /confirmation with no booking (deep link / after reset) should not
  // show a fake success screen — send the user to their bookings instead. Wait
  // for hydration so a freshly-confirmed booking restored from localStorage
  // isn't bounced away.
  useEffect(() => {
    if (hydrated && !state.booking) router.replace("/bookings");
  }, [hydrated, state.booking, router]);

  if (!state.booking) return null;

  return (
    <section className="relative h-full overflow-y-auto bg-white px-4 py-8 sm:py-10 lg:bg-mist">
      {/* Cross button to close the confirmation and return home */}
      <div className="mx-auto flex w-full max-w-2xl justify-end">
        <IconButton label={t("close")} onClick={onHome} className="bg-neutral-100">
          <Icon name="X" className="h-5 w-5" />
        </IconButton>
      </div>

      <div className="mx-auto w-full max-w-2xl text-center">
        <div className="mx-auto mt-2 grid h-24 w-24 place-items-center rounded-full bg-wash-500 text-white shadow-lg shadow-wash-500/30">
          <Icon name="Check" className="h-12 w-12" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-black sm:text-4xl">{t("confirmedTitle")}</h1>
        <p className="mx-auto mt-3 max-w-md text-base text-neutral-600">{t("confirmedCopy")}</p>

        {state.booking ? (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-wash-50 px-6 py-3 text-lg font-black text-wash-600">
            <Icon name="Wallet" className="h-5 w-5" />
            {t("total")}: {formatVnd(state.booking.total)}
          </p>
        ) : null}

        <div className="mt-7 grid gap-5 text-left">
          {state.booking ? <BookingCard booking={state.booking} shop={shop} t={t} /> : null}
          <RewardsCard stamps={state.stamps} voucher={state.voucher} t={t} onUse={onUseVoucher} />
        </div>

        <div className="mt-7 grid gap-3">
          <Button onClick={onBookings} className="min-h-[60px] w-full rounded-2xl text-base">
            <Icon name="Calendar" className="h-5 w-5" />
            {t("viewMyBookings")}
          </Button>
          <Button variant="secondary" onClick={onHome} className="min-h-[52px] text-base">
            {t("bookAnother")}
          </Button>
        </div>
      </div>
    </section>
  );
}
