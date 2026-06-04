import { TopBar } from "../components/layout/TopBar.jsx";
import { BookingCard } from "./shared/BookingCard.jsx";

export function BookingsScreen({ state, shop, t, onLang, onHome }) {
  return (
    <section className="h-full overflow-y-auto bg-white px-4 py-7">
      <TopBar compact title={t("bookings")} t={t} lang={state.lang} onLang={onLang} onHome={onHome} />
      {state.booking ? (
        <BookingCard booking={state.booking} shop={shop} t={t} />
      ) : (
        <div className="rounded-[18px] border border-black/10 bg-white p-7 text-center text-sm text-neutral-500">{t("noBookings")}</div>
      )}
    </section>
  );
}
