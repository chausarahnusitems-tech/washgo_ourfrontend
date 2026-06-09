import { images } from "../assets.js";
import { calendarDays, services, times } from "../data/catalog.js";
import { getDiscount, getSelectedDateLabel, getSelectedServices, getSubtotal, getTotal } from "../lib/booking.js";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BookingScreen({ state, shop, t, onLang, onBack, onDate, onTime, onService, onVehicle, onConfirm }) {
  const selectedServices = getSelectedServices(state.selectedServices);
  const subtotal = getSubtotal(state.selectedServices);
  const discount = getDiscount(state.selectedPlan, state.selectedServices);
  const total = getTotal(state.selectedPlan, state.selectedServices);

  return (
    <>
      <section className="h-full overflow-y-auto overflow-x-hidden bg-white px-3.5 pb-5 pt-7 lg:bg-mist">
        <div className="mx-auto w-full max-w-2xl">
        <TopBar
          compact
          title={t("bookNow")}
          subtitle={shop.name}
          t={t}
          lang={state.lang}
          onLang={onLang}
          onBack={onBack}
        />

        <section className="rounded-xl border border-black/20 bg-white p-3">
          <h2 className="font-display text-base font-black">{t("selectDate")}</h2>
          <div className="mt-2 grid grid-cols-[34px_1fr_34px] items-center gap-2">
            <button type="button" className="grid h-8 w-9 place-items-center rounded border border-black/20">
              <Icon name="ArrowLeft" className="h-4 w-4" />
            </button>
            <strong className="text-center text-neutral-500">{t("monthMay2026")}</strong>
            <button type="button" className="grid h-8 w-9 place-items-center rounded border border-black/20">
              <Icon name="ArrowLeft" className="h-4 w-4 rotate-180" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {weekdays.map((day) => (
              <span key={day} className="text-center text-[0.72rem] font-black">
                {day}
              </span>
            ))}
            {calendarDays.map((item, index) => {
              const selected = item.id && item.id === state.selectedDate;
              return (
                <button
                  key={`${item.day}-${index}`}
                  type="button"
                  onClick={() => item.id && onDate(item.id)}
                  className={`min-h-7 rounded-md text-sm font-bold ${
                    selected
                      ? "bg-wash-500 text-white shadow-cta"
                      : item.muted
                        ? "text-neutral-400"
                        : "text-ink"
                  }`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex min-h-7 items-center gap-2 bg-wash-50 px-2 text-sm text-wash-600">
            <Icon name="Gift" className="h-4 w-4" />
            <span>{t("advanceDeal")}</span>
          </div>
        </section>

        <section className="mt-3 rounded-xl border border-black/20 bg-white p-3">
          <h2 className="font-display text-base font-black">{t("selectTime")}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {times.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => onTime(time)}
                className={`min-h-11 rounded-md border text-sm font-black ${
                  state.selectedTime === time ? "border-wash-500 bg-wash-500 text-white" : "border-black/20 bg-white"
                }`}
              >
                {time}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-3 rounded-xl border border-black/20 bg-white p-3">
          <h2 className="font-display text-base font-black">{t("chooseServices")}</h2>
          <p className="mt-1 text-xs text-neutral-500">{t("serviceHint")}</p>
          <div className="mt-3 grid gap-2">
            {services.map((service) => {
              const selected = state.selectedServices.includes(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onService(service.id)}
                  aria-pressed={selected}
                  className={`flex min-h-9 items-center justify-between rounded px-3 text-sm ${
                    selected ? "bg-wash-500 font-black text-white" : "border border-black/10 bg-white text-ink"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon name={service.icon} className="h-4 w-4" />
                    <strong>{t(service.id)}</strong>
                  </span>
                  <span>
                    {service.token} {t("tokenShort")} · {selected ? t("selected") : t("add")}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-3 grid grid-cols-[92px_1fr] gap-3 rounded-xl border border-black/10 bg-white p-3">
          <img src={images.hero} alt={shop.name} className="h-24 w-24 rounded-lg object-cover object-[58%_center]" />
          <div className="min-w-0">
            <small className="text-neutral-500">{t("serviceSummary")}</small>
            <h2 className="mt-1 flex items-center gap-1 truncate font-display text-base font-black">
              {shop.name} <Icon name="ShieldCheck" className="h-4 w-4" />
            </h2>
            <p className="mt-1 text-xs text-neutral-600">{selectedServices.map((service) => t(service.id)).join(" · ")}</p>
            <strong className="mt-1 block">{subtotal} {t("tokens")}</strong>
          </div>
        </section>

        <section className="mt-3 rounded-xl border border-black/20 bg-white p-3">
          <h2 className="font-display text-base font-black">{t("vehicleDetails")}</h2>
          <label className="mt-3 block">
            <span className="text-xs font-bold text-neutral-500">{t("licensePlate")}</span>
            <input
              value={state.vehicle.plate}
              onChange={(event) => onVehicle({ plate: event.target.value })}
              className="mt-1 min-h-11 w-full rounded-xl border border-black/10 bg-neutral-100 px-3 outline-none focus:ring-4 focus:ring-wash-500/20"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-bold text-neutral-500">{t("notes")}</span>
            <textarea
              value={state.vehicle.notes}
              onChange={(event) => onVehicle({ notes: event.target.value })}
              placeholder={t("notesPlaceholder")}
              className="mt-1 min-h-20 w-full resize-none rounded-xl border border-black/10 bg-neutral-100 p-3 outline-none focus:ring-4 focus:ring-wash-500/20"
            />
          </label>
        </section>

        <section className="mt-3 rounded-xl border border-black/20 bg-white p-3">
          <h2 className="font-display text-base font-black">{t("tokenDetails")}</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {selectedServices.map((service) => (
              <div key={service.id} className="flex justify-between">
                <span>{t(service.id)}</span>
                <strong>{service.token}</strong>
              </div>
            ))}
            {discount ? (
              <div className="flex justify-between text-lime-700">
                <span>{t("discount")}</span>
                <strong>-{discount}</strong>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-black/10 pt-2 text-lg font-black">
              <span>{t("total")}</span>
              <strong>{total}</strong>
            </div>
          </div>
        </section>
        </div>
      </section>

      <footer className="border-t border-black/20 bg-white px-2 py-4">
        <div className="mx-auto w-full max-w-2xl">
        <Button onClick={onConfirm} disabled={!total} className="min-h-[54px] w-full rounded-full px-4">
          <Icon name="Calendar" className="h-5 w-5" />
          <span className="grid flex-1 text-left">
            <strong>{t("confirmBooking")}</strong>
            <small className="text-white/85">{getSelectedDateLabel(state.selectedDate, t)}, {state.selectedTime}</small>
          </span>
          <Icon name="ArrowLeft" className="h-5 w-5 rotate-180" />
        </Button>
        </div>
      </footer>
    </>
  );
}
