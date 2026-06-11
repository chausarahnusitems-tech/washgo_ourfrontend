"use client";

import { getCurrentShop } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";
import { BookingCard } from "./shared/BookingCard.jsx";

export function BookingsScreen() {
  const { t, state } = useApp();
  const bookings = state.bookings ?? [];

  return (
    <section className="h-full overflow-y-auto bg-white px-4 py-7 lg:bg-mist">
      <div className="mx-auto w-full max-w-2xl">
        <TopBar compact title={t("bookings")} subtitle={bookings.length ? `${bookings.length}` : undefined} />
        {bookings.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {bookings.map((booking) => (
              <BookingCard
                key={booking.id ?? `${booking.shopId}-${booking.date}-${booking.time}`}
                booking={booking}
                shop={getCurrentShop(booking.shopId)}
                t={t}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-black/10 bg-white p-7 text-center text-sm text-neutral-500">{t("noBookings")}</div>
        )}
      </div>
    </section>
  );
}
