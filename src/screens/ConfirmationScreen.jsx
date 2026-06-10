"use client";

import { useRouter } from "next/navigation";
import { getCurrentShop } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { RewardsCard } from "../components/RewardsCard.jsx";
import { BookingCard } from "./shared/BookingCard.jsx";

export function ConfirmationScreen() {
  const router = useRouter();
  const { t, state } = useApp();
  const shop = getCurrentShop(state.booking?.shopId);
  const onRewards = () => router.push("/rewards");
  const onHome = () => router.push("/");
  return (
    <section className="h-full overflow-y-auto bg-white px-4 py-7 text-center lg:bg-mist">
      <div className="mx-auto w-full max-w-xl">
      <div className="mx-auto mt-5 grid h-16 w-16 place-items-center rounded-full bg-wash-500 text-white">
        <Icon name="Check" className="h-8 w-8" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-black">{t("confirmedTitle")}</h1>
      <p className="mx-5 mt-2 text-sm text-neutral-600">{t("confirmedCopy")}</p>

      <div className="mt-5 grid gap-4 text-left">
        {state.booking ? <BookingCard booking={state.booking} shop={shop} t={t} /> : null}
        <RewardsCard stamps={state.stamps} voucher={state.voucher} t={t} onUse={onHome} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onRewards}>{t("viewRewards")}</Button>
        <Button onClick={onHome}>{t("bookAnother")}</Button>
      </div>
      </div>
    </section>
  );
}
