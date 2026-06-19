"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { images } from "../assets.js";
import { times } from "../data/catalog.js";
import {
  formatVnd,
  generateSlots,
  getCouponDiscount,
  getDayHours,
  getDiscount,
  getSelectedDateLabel,
  getSelectedServices,
  getSubtotal,
  getTotal,
  isWeeklyClosed
} from "../lib/booking.js";
import { addMonths, buildMonthGrid, formatMonthLabel, resolveBookingIso, toIsoDate, WEEKDAYS_SHORT } from "../lib/calendar.js";
import { useApp } from "../lib/AppContext.jsx";
import { createClient } from "../lib/supabase/client.js";
import { fetchSlotAvailability } from "../lib/data/api.js";
import { startCheckout } from "../lib/data/billing.js";
import { useBackOr } from "../lib/useBackOr.js";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";
import { CarModelPicker } from "../components/booking/CarModelPicker.jsx";

export function BookingScreen({ shopId }) {
  const router = useRouter();
  const onBack = useBackOr("/explore");
  const supabase = useMemo(() => createClient(), []);
  const { t, state, catalog, mode, auth, requireAuth, promo, applyPromo, clearPromo, setDate: onDate, setTime: onTime, toggleService: onService, setVehicle: onVehicle, confirmBooking } = useApp();

  // Promo/referral code entry (item 4).
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState(false);
  const [promoBusy, setPromoBusy] = useState(false);

  const onApplyPromo = async () => {
    setPromoBusy(true);
    setPromoError(false);
    const ok = await applyPromo(promoInput);
    if (!ok) setPromoError(true);
    else setPromoInput("");
    setPromoBusy(false);
  };

  // Calendar is generated from the real current month so the arrows navigate and
  // the grid never goes stale.
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  // Guard against double-submission: a second click while the first
  // confirmBooking() is still in flight would create a duplicate booking.
  const [submitting, setSubmitting] = useState(false);
  const [bookError, setBookError] = useState(null);
  // Per-slot availability for the picked date (counts + cap + closed-day flag).
  const [availability, setAvailability] = useState(null);

  // Resolve from the same live catalog the rest of the screen reads, so a valid
  // DB shop isn't briefly mistaken for not-found on a deep link.
  const shop = (catalog.shops ?? []).find((s) => s.id === shopId) ?? null;

  // Opening hours for the picked date (per-weekday when the owner set a weekly
  // schedule, else the shop default). null = closed that weekday.
  const dayHours = getDayHours(shop, state.selectedDate);
  const weeklyClosed = isWeeklyClosed(shop, state.selectedDate);
  // Time slots: generated from the day's hours when set, else the legacy fixed
  // list (demo / not-yet-configured shops). Empty when the shop is closed.
  const slots = useMemo(
    () => (dayHours ? generateSlots(dayHours.open, dayHours.close, shop?.slotMinutes) ?? times : []),
    [dayHours?.open, dayHours?.close, shop?.slotMinutes]
  );

  // Load availability for the selected date (backend only). Lets us grey out
  // full or closed slots before the server rejects them.
  const isoDate = resolveBookingIso(state.selectedDate);
  useEffect(() => {
    if (mode !== "backend" || !supabase || !shop?.id || !isoDate) {
      setAvailability(null);
      return undefined;
    }
    let active = true;
    fetchSlotAvailability(supabase, shop.id, isoDate)
      .then((res) => active && setAvailability(res))
      .catch(() => active && setAvailability(null));
    return () => {
      active = false;
    };
  }, [mode, supabase, shop?.id, isoDate]);

  // True when a slot is at capacity for the picked date.
  const slotFull = (time) =>
    Boolean(availability && (availability.counts?.[time] ?? 0) >= (availability.cap ?? 1));

  // Keep selectedTime valid (#6): when the slot list / availability changes, if
  // the current selection isn't an offered, non-full slot, snap to the first open
  // one. Stops a stale "12.00PM" default being submitted on a structured-hours
  // shop where no generated "HH:MM" slot matches it.
  useEffect(() => {
    if (weeklyClosed || availability?.closed) return;
    const selectable = (t) => slots.includes(t) && !slotFull(t);
    if (!selectable(state.selectedTime)) {
      const next = slots.find((t) => !slotFull(t));
      if (next) onTime(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, availability, weeklyClosed, state.selectedDate, state.selectedTime]);

  // Booking requires a signed-in user (item 25). Gate at the entry point — send a
  // signed-out visitor to login (with a return path) instead of letting them fill
  // the whole form only to be bounced at the final tap. Wait for the session
  // check to finish so we don't redirect mid-hydration.
  useEffect(() => {
    if (!auth.loading && requireAuth) {
      router.replace(`/login?next=${encodeURIComponent(`/shops/${shopId}/book`)}`);
    }
  }, [auth.loading, requireAuth, router, shopId]);

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

  // Directory listings (imported, info-only shops that haven't partnered with
  // Washgo yet) can't be booked — guard the deep link /shops/<directoryId>/book.
  if (shop.listingType === "directory") {
    return (
      <section className="h-full overflow-y-auto bg-white px-3.5 pb-16 pt-7 lg:bg-mist">
        <div className="mx-auto w-full max-w-2xl">
          <TopBar compact title={t("bookNow")} subtitle={shop.name} onBack={onBack} />
          <div className="mt-10 grid place-items-center gap-4 rounded-[18px] border border-black/10 bg-white px-6 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-amber-600">
              <Icon name="Info" className="h-7 w-7" />
            </span>
            <p className="text-sm text-neutral-500">{t("notBookable")}</p>
            <Button onClick={() => router.push("/explore")}>
              <Icon name="Search" className="h-5 w-5" />
              {t("exploreCarWashes")}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // Signed-out (backend) users can't book — show a sign-in prompt while the
  // entry-point redirect (above) takes them to login.
  if (!auth.loading && requireAuth) {
    return (
      <section className="h-full overflow-y-auto bg-white px-3.5 pb-16 pt-7 lg:bg-mist">
        <div className="mx-auto w-full max-w-2xl">
          <TopBar compact title={t("bookNow")} subtitle={shop.name} onBack={onBack} />
          <div className="mt-10 grid place-items-center gap-4 rounded-[18px] border border-black/10 bg-white px-6 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-wash-50 text-wash-500">
              <Icon name="Lock" className="h-7 w-7" />
            </span>
            <p className="text-sm text-neutral-500">{t("signInToBook")}</p>
            <Button onClick={() => router.push(`/login?next=${encodeURIComponent(`/shops/${shop.id}/book`)}`)}>
              <Icon name="LogIn" className="h-5 w-5" />
              {t("signInToContinue")}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // Bookable menu = this shop's own services (e.g. Würth Go shows its WÜRTH
  // menu); fall back to the standard catalogue for shops with none attached.
  const STANDARD_SERVICE_IDS = ["exterior", "interior", "detailing", "wax"];
  const allServices = catalog.services ?? [];
  const ownServices = (shop.services ?? [])
    .map((id) => allServices.find((s) => s.id === id))
    .filter(Boolean);
  const bookableServices = ownServices.length
    ? ownServices
    : allServices.filter((s) => STANDARD_SERVICE_IDS.includes(s.id));
  // Only price/book selections this shop actually offers — a stale global pick
  // from another shop shouldn't carry over here.
  const effectiveSelected = state.selectedServices.filter((id) =>
    bookableServices.some((s) => s.id === id)
  );

  const onConfirm = async () => {
    if (submitting) return;
    if (requireAuth) {
      router.push("/login");
      return;
    }
    setSubmitting(true);
    setBookError(null);
    const ok = await confirmBooking(shop.id, effectiveSelected);
    if (ok) {
      router.push("/confirmation");
      return; // leave the button disabled while we navigate away
    }
    setBookError(t("bookingFailed"));
    setSubmitting(false); // re-enable only if the booking failed
  };

  // Pay this booking directly by card / QR (PayOS) instead of from the wallet.
  // The server creates a pending_payment booking and the webhook confirms it; on
  // success the browser is redirected to the hosted gateway page.
  const onPayCard = async () => {
    if (submitting) return;
    if (requireAuth) {
      router.push("/login");
      return;
    }
    setSubmitting(true);
    setBookError(null);
    const err = await startCheckout({
      kind: "booking",
      shopId: shop.id,
      date: resolveBookingIso(state.selectedDate),
      slot: state.selectedTime,
      serviceIds: effectiveSelected,
      couponCode: promo?.code || null,
      next: `/shops/${shop.id}/book`
    });
    if (err) {
      setSubmitting(false);
      setBookError(
        err === "payments_not_configured"
          ? "Card payment isn't set up yet — please pay from your wallet."
          : t("bookingFailed")
      );
    }
  };

  const selectedServices = getSelectedServices(effectiveSelected);
  const subtotal = getSubtotal(effectiveSelected);
  const discount = getDiscount(state.selectedPlan, effectiveSelected);
  const total = getTotal(state.selectedPlan, effectiveSelected);

  // A pending free-wash voucher makes the booking free; otherwise the wallet
  // must cover the total (after any membership + promo-code discount).
  const redeeming = Boolean(state.pendingVoucher && state.voucher);
  const couponDiscount = redeeming ? 0 : getCouponDiscount(promo, subtotal, discount);
  const charge = redeeming ? 0 : Math.max(0, total - couponDiscount);
  const insufficient = charge > state.funds;
  // Exact amount the wallet is short by, for the top-up affordance (item 7).
  const shortfall = Math.max(0, charge - state.funds);
  // The shop is closed for the picked date, or no valid/open slot is selected —
  // block the Book button so we don't submit something the server will reject (#6).
  const dateClosed = Boolean(weeklyClosed || availability?.closed);
  const slotSelectable = slots.includes(state.selectedTime) && !slotFull(state.selectedTime);

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
              const disabled = cell.muted || cell.past || isWeeklyClosed(shop, cell.iso);
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
          {availability?.closed || weeklyClosed ? (
            <p className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-500">
              {t("closedOnDate")}
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {slots.map((time) => {
                const count = availability?.counts?.[time] ?? 0;
                const full = availability ? count >= availability.cap : false;
                const selected = state.selectedTime === time;
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={full}
                    onClick={() => onTime(time)}
                    className={`min-h-11 rounded-md border text-sm font-black ${
                      selected
                        ? "border-wash-500 bg-wash-500 text-white"
                        : full
                          ? "border-black/10 bg-neutral-100 text-neutral-300 line-through"
                          : "border-black/20 bg-white"
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-3 rounded-xl border border-black/20 bg-white p-3">
          <h2 className="font-display text-base font-black">{t("chooseServices")}</h2>
          <p className="mt-1 text-xs text-neutral-500">{t("serviceHint")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {bookableServices.map((service) => {
              const selected = state.selectedServices.includes(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onService(service.id)}
                  aria-pressed={selected}
                  className={`relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl p-3 text-center transition ${
                    selected ? "bg-wash-500 text-white shadow-cta" : "border border-black/10 bg-white text-ink"
                  }`}
                >
                  {selected ? (
                    <Icon name="Check" className="absolute right-2 top-2 h-4 w-4" />
                  ) : null}
                  <Icon name={service.icon} className="h-7 w-7" />
                  <strong className="text-sm leading-tight">{t(service.id)}</strong>
                  <span className={`text-xs ${selected ? "text-white/90" : "text-neutral-500"}`}>
                    {formatVnd(service.price)} · {selected ? t("selected") : t("add")}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-3 grid grid-cols-[92px_1fr] gap-3 rounded-xl border border-black/10 bg-white p-3">
          <img
            src={shop.imageUrl || images.hero}
            alt={shop.name}
            className={`h-24 w-24 rounded-lg object-cover ${shop.imageUrl ? "" : shop.imagePosition ?? "object-[58%_center]"}`}
          />
          <div className="min-w-0">
            <small className="text-neutral-500">{t("serviceSummary")}</small>
            <h2 className="mt-1 flex items-center gap-1 truncate font-display text-base font-black">
              {shop.name} <Icon name="ShieldCheck" className="h-4 w-4" />
            </h2>
            {shop.rating && shop.rating !== "0.0" ? (
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-wash-500">
                <Icon name="Star" className="h-3.5 w-3.5" />
                {shop.rating}
                <span className="font-normal text-neutral-400">({shop.reviews})</span>
              </span>
            ) : null}
            <p className="mt-1 text-xs text-neutral-600">{selectedServices.map((service) => t(service.id)).join(" · ")}</p>
            <strong className="mt-1 block">{formatVnd(subtotal)}</strong>
          </div>
        </section>

        <section className="mt-3 rounded-xl border border-black/20 bg-white p-3">
          <h2 className="font-display text-base font-black">{t("vehicleDetails")}</h2>
          <label className="mt-3 block">
            <span className="text-xs font-bold text-neutral-500">{t("vehicleModel")}</span>
            <CarModelPicker
              value={state.vehicle.model}
              onSelect={(model) => onVehicle({ model })}
              t={t}
              placeholder={t("searchCarModel")}
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
            {couponDiscount > 0 ? (
              <div className="flex justify-between text-lime-700">
                <span>{t("couponDiscount")}{promo?.code ? ` · ${promo.code}` : ""}</span>
                <strong>-{formatVnd(couponDiscount)}</strong>
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

          {/* Promo / referral code entry (item 4). Hidden when a free wash is armed. */}
          {!redeeming ? (
            <div className="mt-3 border-t border-black/10 pt-3">
              {promo ? (
                <div className="flex items-center justify-between rounded-xl bg-lime-50 px-3 py-2 text-sm font-bold text-lime-700">
                  <span className="inline-flex items-center gap-2">
                    <Icon name="Tag" className="h-4 w-4" />
                    {promo.code} · {t("codeApplied")}
                  </span>
                  <button type="button" onClick={clearPromo} className="text-xs underline">
                    {t("removeCode")}
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-bold text-neutral-500">{t("havePromo")}</span>
                  <div className="mt-1 flex gap-2">
                    <input
                      value={promoInput}
                      onChange={(event) => {
                        setPromoInput(event.target.value);
                        setPromoError(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          onApplyPromo();
                        }
                      }}
                      placeholder={t("promoPlaceholder")}
                      className="min-h-11 flex-1 rounded-xl border border-black/10 bg-neutral-100 px-3 uppercase outline-none placeholder:normal-case focus:ring-4 focus:ring-wash-500/20"
                    />
                    <button
                      type="button"
                      onClick={onApplyPromo}
                      disabled={promoBusy || !promoInput.trim()}
                      className="min-h-11 rounded-xl bg-wash-500 px-4 text-sm font-black text-white disabled:opacity-40"
                    >
                      {t("applyCode")}
                    </button>
                  </div>
                  {promoError ? (
                    <p className="mt-1 text-xs font-bold text-red-600">{t("invalidCode")}</p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </section>

        {/* Insufficient-balance recovery path — top up without losing the form. */}
        {insufficient ? (
          <button
            type="button"
            onClick={() => router.push(`/topup?amount=${shortfall}&next=${encodeURIComponent(`/shops/${shop.id}/book`)}`)}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-wash-300 bg-wash-50 px-4 py-3 text-left text-sm font-bold text-wash-600"
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="Wallet" className="h-4 w-4" />
              <span className="grid">
                {t("insufficientBalance")}
                <small className="font-normal text-wash-500">{t("shortBy")} {formatVnd(shortfall)}</small>
              </span>
            </span>
            <span className="inline-flex items-center gap-1">
              {t("topUpToBook")}
              <Icon name="Plus" className="h-4 w-4" />
            </span>
          </button>
        ) : null}

        {bookError ? (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
            {bookError}
          </p>
        ) : null}

        {/* Book button lives in the scroll flow (not a pinned footer) with
            bottom padding below, so it reads as the end of the form. The wallet
            path pays from the balance; the card path (backend, charge > 0) hands
            off to the hosted PayOS checkout. */}
        <Button onClick={onConfirm} disabled={!total || insufficient || submitting || dateClosed || !slotSelectable} className="mt-5 min-h-[54px] w-full rounded-full px-4">
          <Icon name="Calendar" className="h-5 w-5" />
          <span className="grid flex-1 text-left">
            <strong>{mode === "backend" && !redeeming && charge > 0 ? t("payFromWallet") : t("book")}</strong>
            <small className="text-white/85">{getSelectedDateLabel(state.selectedDate, t)}, {state.selectedTime}</small>
          </span>
          <Icon name="ArrowLeft" className="h-5 w-5 rotate-180" />
        </Button>

        {mode === "backend" && !redeeming && charge > 0 ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onPayCard}
            disabled={submitting || dateClosed || !slotSelectable}
            className="mt-3 min-h-[54px] w-full rounded-full px-4"
          >
            <Icon name="WalletCards" className="h-5 w-5" />
            <span className="grid flex-1 text-left">
              <strong>{t("payByCard")}</strong>
              <small className="text-neutral-500">{formatVnd(charge)} · {t("securedByPayos")}</small>
            </span>
            <Icon name="ArrowLeft" className="h-5 w-5 rotate-180" />
          </Button>
        ) : null}
        </div>
      </section>
  );
}
