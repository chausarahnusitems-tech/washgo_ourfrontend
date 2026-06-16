"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { images } from "../assets.js";
import { dates, times } from "../data/catalog.js";
import {
  formatVnd,
  getBookingById,
  getBookingStatus,
  getCurrentShop,
  getDiscount,
  getSelectedDateLabel,
  getSelectedServices,
  getSubtotal,
  getTotal
} from "../lib/booking.js";
import { resolveBookingIso, toIsoDate } from "../lib/calendar.js";
import { useApp } from "../lib/AppContext.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Icon } from "../components/ui/Icon.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";

const statusTones = {
  upcoming: "bg-wash-50 text-wash-600",
  completed: "bg-emerald-50 text-emerald-600",
  cancelled: "bg-neutral-100 text-neutral-500"
};

export function BookingDetailScreen({ bookingId }) {
  const router = useRouter();
  const { t, state, catalog, requireAuth, updateBooking, cancelBooking, deleteBooking } = useApp();
  const booking = getBookingById(state.bookings, bookingId);

  const [editing, setEditing] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [draft, setDraft] = useState(() => ({
    dateId: booking?.dateId ?? "today",
    time: booking?.time ?? times[0],
    services: booking?.services ?? []
  }));

  const onBack = () => router.push("/bookings");

  if (!booking) {
    return (
      <section className="grid h-full place-items-center bg-white px-6 text-center lg:bg-mist">
        <div>
          <p className="text-neutral-500">{t("bookingNotFound")}</p>
          <Button onClick={onBack} className="mt-4">{t("bookings")}</Button>
        </div>
      </section>
    );
  }

  const status = getBookingStatus(booking);
  const isUpcoming = status === "upcoming";
  // "Watch live" (deferred feature, stub only) is offered while the wash is
  // plausibly happening: an upcoming booking scheduled for today. resolveBookingIso
  // normalises both legacy quick-pick ids and stored ISO dates.
  const canWatchLive = isUpcoming && resolveBookingIso(booking.dateId) === toIsoDate(new Date());
  const shop = getCurrentShop(booking.shopId);
  const statusLabel = {
    upcoming: t("statusUpcoming"),
    completed: t("statusCompleted"),
    cancelled: t("statusCancelled")
  }[status];

  // Price edits under the plan the booking was made on (not the current plan),
  // so an unrelated date/time change can't retroactively re-discount it.
  const pricingPlan = booking.plan ?? state.selectedPlan;

  // Totals preview the draft while editing, otherwise reflect the stored booking.
  const viewServices = editing ? draft.services : booking.services;
  const selectedServices = getSelectedServices(viewServices);
  const subtotal = getSubtotal(viewServices);
  const discount = getDiscount(pricingPlan, viewServices);
  const draftTotal = getTotal(pricingPlan, draft.services);
  const total = editing ? draftTotal : booking.total;
  // A pricier edit must be covered by the wallet (only the extra is charged).
  const extraCharge = Math.max(0, draftTotal - booking.total);
  const affordable = extraCharge <= state.funds;
  const canSave = draftTotal > 0 && affordable;
  const dateLabel = editing ? getSelectedDateLabel(draft.dateId, t) : booking.date;

  const startEdit = () => {
    setDraft({ dateId: booking.dateId ?? "today", time: booking.time, services: [...booking.services] });
    setEditing(true);
  };

  const toggleDraftService = (id) =>
    setDraft((d) => ({
      ...d,
      services: d.services.includes(id) ? d.services.filter((s) => s !== id) : [...d.services, id]
    }));

  const saveEdit = async () => {
    if (!canSave) return;
    if (requireAuth) {
      router.push("/login");
      return;
    }
    const ok = await updateBooking(booking.id, { dateId: draft.dateId, time: draft.time, services: draft.services });
    if (ok) setEditing(false);
  };

  const onCancelBooking = async () => {
    if (requireAuth) {
      router.push("/login");
      return;
    }
    await cancelBooking(booking.id);
    router.push("/bookings");
  };

  const onDeleteBooking = async () => {
    if (requireAuth) {
      router.push("/login");
      return;
    }
    await deleteBooking(booking.id);
    router.push("/bookings");
  };

  return (
    <section className="h-full overflow-y-auto bg-white px-4 pb-16 pt-7 lg:bg-mist">
      <div className="mx-auto w-full max-w-xl">
        <TopBar compact hideLogo title={t("bookingDetails")} subtitle={shop.name} onBack={onBack} />

        {/* Hero + status */}
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
          <div className="relative h-40 w-full overflow-hidden bg-neutral-100">
            <img src={images.hero} alt={shop.name} className={`h-full w-full object-cover ${shop.imagePosition}`} />
            <span className={`absolute left-3 top-3 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${statusTones[status]}`}>
              {statusLabel}
            </span>
          </div>
          <div className="p-4">
            <h1 className="font-display text-xl font-black">{shop.name}</h1>
            <p className="mt-1 flex items-start gap-2 text-sm text-neutral-600">
              <Icon name="MapPin" className="mt-0.5 h-4 w-4 shrink-0" />
              {shop.address}
            </p>
          </div>
        </div>

        {/* Date & time */}
        <section className="mt-3 rounded-xl border border-black/15 bg-white p-3">
          <h2 className="font-display text-base font-black">{t("dateTime")}</h2>
          {editing ? (
            <>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {dates.map((d) => {
                  const selected = draft.dateId === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDraft((s) => ({ ...s, dateId: d.id }))}
                      className={`grid min-h-14 place-items-center rounded-lg border text-sm font-black ${
                        selected ? "border-wash-500 bg-wash-500 text-white" : "border-black/15 bg-white"
                      }`}
                    >
                      <span className="text-[0.7rem] uppercase">{t(d.label)}</span>
                      <span>{d.number}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {times.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setDraft((s) => ({ ...s, time }))}
                    className={`min-h-11 rounded-md border text-sm font-black ${
                      draft.time === time ? "border-wash-500 bg-wash-500 text-white" : "border-black/15 bg-white"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
              <Icon name="Calendar" className="h-4 w-4 text-wash-500" />
              {dateLabel} · {booking.time}
            </p>
          )}
        </section>

        {/* Services */}
        <section className="mt-3 rounded-xl border border-black/15 bg-white p-3">
          <h2 className="font-display text-base font-black">{t("chooseServices")}</h2>
          {editing ? (
            <div className="mt-3 grid gap-2">
              {catalog.services.map((service) => {
                const selected = draft.services.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleDraftService(service.id)}
                    aria-pressed={selected}
                    className={`flex min-h-9 items-center justify-between rounded px-3 text-sm ${
                      selected ? "bg-wash-500 font-black text-white" : "border border-black/10 bg-white text-ink"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon name={service.icon} className="h-4 w-4" />
                      <strong>{t(service.id)}</strong>
                    </span>
                    <span>{formatVnd(service.price)} · {selected ? t("selected") : t("add")}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 grid gap-2 text-sm">
              {selectedServices.map((service) => (
                <div key={service.id} className="flex justify-between">
                  <span className="inline-flex items-center gap-2">
                    <Icon name={service.icon} className="h-4 w-4" />
                    {t(service.id)}
                  </span>
                  <strong>{formatVnd(service.price)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Payment summary */}
        <section className="mt-3 rounded-xl border border-black/15 bg-white p-3">
          <h2 className="font-display text-base font-black">{t("paymentDetails")}</h2>
          <div className="mt-3 grid gap-2 text-sm">
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
            <div className="flex justify-between border-t border-black/10 pt-2 text-lg font-black">
              <span>{t("total")}</span>
              <strong>{formatVnd(total)}</strong>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="mt-5 grid gap-3">
          {editing ? (
            <>
              {!affordable ? (
                <p className="text-center text-xs font-bold text-wash-600">{t("insufficientBalance")}</p>
              ) : null}
              <Button onClick={saveEdit} disabled={!canSave} className="min-h-[52px] w-full rounded-2xl">
                <Icon name="Check" className="h-5 w-5" />
                {t("saveChanges")}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>{t("discardChanges")}</Button>
            </>
          ) : isUpcoming ? (
            <>
              {canWatchLive && (
                <Button onClick={() => setShowLive(true)} className="min-h-[52px] w-full rounded-2xl">
                  <Icon name="Eye" className="h-5 w-5" />
                  {t("watchLive")}
                </Button>
              )}
              <Button onClick={startEdit} className="min-h-[52px] w-full rounded-2xl">
                <Icon name="Pencil" className="h-5 w-5" />
                {t("editBooking")}
              </Button>
              <Button variant="secondary" onClick={onCancelBooking}>
                <Icon name="X" className="h-5 w-5" />
                {t("cancelBooking")}
              </Button>
              <p className="text-center text-xs text-neutral-400">{t("cancelRefundNote")}</p>
            </>
          ) : (
            <>
              <Button onClick={() => router.push(`/shops/${shop.id}/book`)} className="min-h-[52px] w-full rounded-2xl">
                <Icon name="RotateCcw" className="h-5 w-5" />
                {t("rebook")}
              </Button>
              <Button variant="secondary" onClick={onDeleteBooking}>
                <Icon name="Trash2" className="h-5 w-5" />
                {t("deleteBooking")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* DEFERRED FEATURE — live-view stub. No streaming backend yet; this only
          surfaces the entry point. Real implementation (managed provider or
          WebRTC + Supabase Realtime signaling) is a separate future phase. */}
      {showLive && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowLive(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-wash-50 text-wash-600">
              <Icon name="Eye" className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-lg font-black">{shop.name}</h2>
            <p className="mt-2 text-sm text-neutral-600">{t("liveComingSoon")}</p>
            <Button onClick={() => setShowLive(false)} className="mt-5 w-full">
              {t("close")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
