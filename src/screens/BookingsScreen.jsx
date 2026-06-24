"use client";

import { useRouter } from "next/navigation";
import {
  getCurrentShop,
  getHistoryBookings,
  getUpcomingBookings
} from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { BookingCard } from "./shared/BookingCard.jsx";

export function BookingsScreen() {
  const router = useRouter();
  const { t, state, redeemVoucher } = useApp();

  const upcoming = getUpcomingBookings(state.bookings);
  const history = getHistoryBookings(state.bookings);
  const hasAny = (state.bookings ?? []).length > 0;

  const summary =
    upcoming.length === 0
      ? t("bookingsSummaryNone")
      : upcoming.length === 1
        ? t("bookingsSummaryOne")
        : t("bookingsSummaryMany").replace("{n}", upcoming.length);

  const onOpen = (id) => router.push(`/bookings/${id}`);
  const onUseVoucher = () => {
    redeemVoucher();
    router.push("/explore");
  };

  return (
    <section className="h-full overflow-y-auto bg-white px-4 py-7 lg:bg-mist">
      <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
        <TopBar compact hideLogo title={t("bookings")} subtitle={hasAny ? summary : undefined} />

        <LoyaltyStrip stamps={state.stamps} voucher={state.voucher} t={t} onUse={onUseVoucher} />

        {hasAny ? (
          <>
            <BookingSection
              title={t("upcomingBookings")}
              bookings={upcoming}
              empty={t("noUpcoming")}
              t={t}
              onOpen={onOpen}
            />
            {history.length ? (
              <BookingSection title={t("historyTitle")} bookings={history} t={t} onOpen={onOpen} />
            ) : null}
          </>
        ) : (
          <EmptyState t={t} onExplore={() => router.push("/explore")} />
        )}
      </div>
    </section>
  );
}

function LoyaltyStrip({ stamps, voucher, t, onUse }) {
  const totalStamps = 5;
  const filled = Math.max(0, Math.min(totalStamps, stamps ?? 0));
  const remaining = totalStamps - filled;

  const status = voucher
    ? t("freeWashUnlocked")
    : filled === totalStamps - 1
      ? t("oneMoreWash")
      : `${remaining} ${t("washesToGo")}`;

  return (
    <section className="rounded-2xl border border-wash-100 bg-wash-50 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-base font-black text-wash-700">{t("loyaltyTitle")}</h2>
          <p className="mt-0.5 text-sm font-semibold text-wash-600">{status}</p>
        </div>
        {voucher ? (
          <Button onClick={onUse} className="min-h-9 shrink-0 px-4">
            {t("useVoucher")}
          </Button>
        ) : null}
      </div>
      <div className="mt-4 flex items-center gap-1.5">
        {Array.from({ length: totalStamps }, (_, index) => (
          <span
            key={index}
            className={`h-2 flex-1 rounded-full ${index < filled ? "bg-wash-500" : "bg-wash-100"}`}
            aria-hidden="true"
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        <strong className="text-wash-600">{filled}</strong> / {totalStamps} {t("washesCompleted")}
      </p>
    </section>
  );
}

function BookingSection({ title, bookings, empty, t, onOpen }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-base font-black">{title}</h2>
      {bookings.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              shop={getCurrentShop(booking.shopId)}
              t={t}
              onClick={onOpen}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-black/10 bg-white p-5 text-center text-sm text-neutral-500">{empty}</p>
      )}
    </section>
  );
}

function EmptyState({ t, onExplore }) {
  return (
    <div className="grid place-items-center gap-4 rounded-[18px] border border-black/10 bg-white px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-wash-50 text-wash-500">
        <Icon name="Calendar" className="h-7 w-7" />
      </span>
      <div>
        <h2 className="font-display text-lg font-black">{t("noBookingsTitle")}</h2>
        <p className="mt-1 text-sm text-neutral-500">{t("noBookingsCopy")}</p>
      </div>
      <Button onClick={onExplore}>
        <Icon name="Search" className="h-5 w-5" />
        {t("exploreCarWashes")}
      </Button>
    </div>
  );
}
