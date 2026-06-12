"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { images } from "../assets.js";
import { times } from "../data/catalog.js";
import {
  formatVnd,
  getDiscount,
  getSelectedDateLabel,
  getSelectedServices,
  getSubtotal,
  getTotal
} from "../lib/booking.js";
import { addMonths, buildMonthGrid, formatMonthLabel, toIsoDate, WEEKDAYS_SHORT } from "../lib/calendar.js";
import { useApp } from "../lib/AppContext.jsx";
import { useBackOr } from "../lib/useBackOr.js";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";

export function BookingScreen({ shopId }) {
  const router = useRouter();
  const onBack = useBackOr("/explore");
  const { t, state, catalog, requireAuth, setDate: onDate, setTime: onTime, toggleService: onService, setVehicle: onVehicle, confirmBooking } = useApp();

  // Calendar is generated from the real current month so the arrows navigate and
  // the grid never goes stale.
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Resolve from the same live catalog the rest of the screen reads, so a valid
  // DB shop isn't briefly mistaken for not-found on a deep link.
  const shop = (catalog.shops ?? []).find((s) => s.id === shopId) ?? null;

  // A typo'd / stale deep link (e.g. /shops/unknown/book) shouldn't silently
  // book under the first shop — show a not-found placeholder instead.
  if (!shop) {
    return (
      <section className="h-full overflow-y-auto bg-white px-3.5 pb-16 pt-7 lg:bg-mist">
        <div className="mx-auto w-full max-w-2xl">
          <TopBar compact title={t("bookNow")} onBack={onBack} />
          <div className="mt-10 grid place-items-center gap-4 rounded-[18px] border border-black/10 bg-white px-6 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-wash-50 text-wash-500">
              <Icon name="TriangleAlert" className="h-7 w-7" />
            </span>
            <p className="text-sm text-neutral-500">{t("shopNotFound")}</p>
            <Button onClick={() => router.push("/explore")}>
              <Icon name="Search" className="h-5 w-5" />
              {t("exploreCarWashes")}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const onConfirm = async () => {
    if (requireAuth) {
      router.push("/login");
      return;
    }
    const ok = await confirmBooking(shop.id);
    if (ok) router.push("/confirmation");
  };

  const selectedServices = getSelectedServices(state.selectedServices);
  const subtotal = getSubtotal(state.selectedServices);
  const discount = getDiscount(state.selectedPlan, state.selectedServices);
  const total = getTotal(state.selectedPlan, state.selectedServices);

  // A pending free-wash voucher makes the booking free; otherwise the wallet
  // must cover the total.
  const redeeming = Boolean(state.pendingVoucher && state.voucher);
  const charge = redeeming ? 0 : total;
  const insufficient = charge > state.funds;

  const now = new Date();
  const atCurrentMonth =
    viewMonth.getFullYear() === now.getFullYear() && viewMonth.getMonth() === now.getMonth();
  const todayIso = toIsoDate(now);
  const grid = buildMonthGrid(viewMonth.getFullYear(), viewMonth.getMonth());

  return (
    <section className="h-full overflow-y-auto overflow-x-hidden bg-white px-3.5 pb-16 pt-7 lg:bg-mist">
        <div className="mx-auto w-full max-w-2xl">
        <TopBar compact title={t("bookNow")} subtitle={shop.name} onBack={onBack} />

        {redeeming ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-lime-50 px-4 py-2 text-sm font-bold text-lime-700">
            <Icon name="Gift" className="h-4 w-4" />
            {t("freeWashReady")}
          </div>
        ) : null}

        <section className="rounded-xl border border-black/20 bg-white p-3">
          <h2 className="font-display text-base font-black">{t("selectDate")}</h2>
          <div className="mt-2 grid grid-cols-[34px_1fr_34px] items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              disabled={atCurrentMonth}
              aria-label={t("prevMonth")}
              className="grid h-8 w-9 place-items-center rounded border border-black/20 disabled:opacity-40"
            >
              <Icon name="ArrowLeft" className="h-4 w-4" />
            </button>
            <strong className="text-center text-neutral-500">{formatMonthLabel(viewMonth)}</strong>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label={t("nextMonth")}
              className="grid h-8 w-9 place-items-center rounded border border-black/20"
            >
              <Icon name="ArrowLeft" className="h-4 w-4 rotate-180" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {WEEKDAYS_SHORT.map((day) => (
              <span key={day} className="text-center text-[0.72rem] font-black">
                {day}
              </span>
            ))}
            {grid.map((cell) => {
              const selected =
                cell.iso === state.selectedDate ||
                (state.selectedDate === "today" && cell.iso === todayIso);
              const disabled = cell.muted || cell.past;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => onDate(cell.iso)}
                  className={`min-h-7 rounded-md text-sm font-bold ${
                    selected
                      ? "bg-wash-500 text-white shadow-cta"
                      : disabled
                        ? "text-neutral-300"
                        : "text-ink"
                  }`}
                >
                  {cell.day}
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
            {catalog.services.map((service) => {
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
                    {formatVnd(service.price)} · {selected ? t("selected") : t("add")}
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
            <strong className="mt-1 block">{formatVnd(subtotal)}</strong>
          </div>
        </section>

        <section className="mt-3 rounded-xl border border-black/20 bg-white p-3">
          <h2 className="font-display text-base font-black">{t("vehicleDetails")}</h2>
          <label className="mt-3 block">
            <span className="text-xs font-bold text-neutral-500">{t("vehicleModel")}</span>
            <input
              value={state.vehicle.model}
              onChange={(event) => onVehicle({ model: event.target.value })}
              className="mt-1 min-h-11 w-full rounded-xl border border-black/10 bg-neutral-100 px-3 outline-none focus:ring-4 focus:ring-wash-500/20"
            />
          </label>
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
          <h2 className="font-display text-base font-black">{t("paymentDetails")}</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {selectedServices.map((service) => (
              <div key={service.id} className="flex justify-between">
                <span>{t(service.id)}</span>
                <strong>{formatVnd(service.price)}</strong>
              </div>
            ))}
            <div className="flex justify-between text-neutral-500">
              <span>{t("subtotal")}</span>
              <strong>{formatVnd(subtotal)}</strong>
            </div>
            {discount ? (
              <div className="flex justify-between text-lime-700">
                <span>{t("discount")}</span>
                <strong>-{formatVnd(discount)}</strong>
              </div>
            ) : null}
            {redeeming ? (
              <div className="flex justify-between text-lime-700">
                <span>{t("freeWashApplied")}</span>
                <strong>-{formatVnd(total)}</strong>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-black/10 pt-2 text-lg font-black">
              <span>{t("total")}</span>
              <strong>{formatVnd(charge)}</strong>
            </div>
          </div>
        </section>

        {/* Insufficient-balance recovery path — top up without losing the form. */}
        {insufficient ? (
          <button
            type="button"
            onClick={() => router.push("/topup")}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-wash-300 bg-wash-50 px-4 py-3 text-left text-sm font-bold text-wash-600"
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="Wallet" className="h-4 w-4" />
              {t("insufficientBalance")}
            </span>
            <span className="inline-flex items-center gap-1">
              {t("topUpToBook")}
              <Icon name="Plus" className="h-4 w-4" />
            </span>
          </button>
        ) : null}

        {/* Book button lives in the scroll flow (not a pinned footer) with
            bottom padding below, so it reads as the end of the form. */}
        <Button onClick={onConfirm} disabled={!total || insufficient} className="mt-5 min-h-[54px] w-full rounded-full px-4">
          <Icon name="Calendar" className="h-5 w-5" />
          <span className="grid flex-1 text-left">
            <strong>{t("book")}</strong>
            <small className="text-white/85">{getSelectedDateLabel(state.selectedDate, t)}, {state.selectedTime}</small>
          </span>
          <Icon name="ArrowLeft" className="h-5 w-5 rotate-180" />
        </Button>
        </div>
      </section>
  );
}
