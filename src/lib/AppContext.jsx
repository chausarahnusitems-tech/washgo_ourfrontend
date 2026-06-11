"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { copy } from "../data/copy.js";
import {
  getCurrentShop,
  getSelectedDateLabel,
  getTotal,
  initialState,
  toggleItem
} from "./booking.js";

// Bump the version suffix when the persisted shape changes so returning users
// pick up the new defaults/seed data instead of stale state.
const STORAGE_KEY = "washgo:app-state-v3";

const AppContext = createContext(null);

// Restore persisted domain/session state so refreshing mid-flow (e.g. landing
// directly on /confirmation) keeps tokens, stamps and the active booking.
function loadInitialState() {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    return { ...initialState, ...JSON.parse(raw) };
  } catch {
    return initialState;
  }
}

export function AppProvider({ children }) {
  // Start from `initialState` on both server and first client render to keep
  // hydration stable; hydrate persisted state immediately after mount.
  const [state, setState] = useState(initialState);
  // `hydrated` flips true once persisted state has been read, so screens can
  // tell "no data yet" apart from "genuinely empty" (e.g. confirmation guard).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadInitialState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [state]);

  useEffect(() => {
    document.documentElement.lang = state.lang;
  }, [state.lang]);

  const t = useCallback(
    (key) => copy[state.lang][key] ?? copy.en[key] ?? key,
    [state.lang]
  );

  const setLang = useCallback((lang) => {
    setState((prev) => ({ ...prev, lang }));
  }, []);

  const setSelectedPlan = useCallback((selectedPlan) => {
    setState((prev) => ({ ...prev, selectedPlan }));
  }, []);

  // Add cash to the wallet (fake local top-up; the backend will replace this).
  const topUpFunds = useCallback((amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setState((prev) => ({ ...prev, funds: prev.funds + Math.round(value) }));
  }, []);

  const setVehicle = useCallback((patch) => {
    setState((prev) => ({ ...prev, vehicle: { ...prev.vehicle, ...patch } }));
  }, []);

  const toggleService = useCallback((serviceId) => {
    setState((prev) => ({
      ...prev,
      selectedServices: toggleItem(prev.selectedServices, serviceId)
    }));
  }, []);

  const setDate = useCallback((selectedDate) => {
    setState((prev) => ({ ...prev, selectedDate }));
  }, []);

  const setTime = useCallback((selectedTime) => {
    setState((prev) => ({ ...prev, selectedTime }));
  }, []);

  // Mark the unlocked free-wash voucher to be applied to the next booking.
  // No-op unless a voucher is actually unlocked.
  const redeemVoucher = useCallback(() => {
    setState((prev) => (prev.voucher ? { ...prev, pendingVoucher: true } : prev));
  }, []);

  // Confirm a booking for the shop named by the current route. Returns false
  // when there's nothing to charge (no services selected) OR the wallet can't
  // cover the total, so the caller can avoid navigating to the confirmation
  // screen. A pending free-wash voucher makes the booking free and restarts the
  // loyalty card.
  const confirmBooking = useCallback((shopId) => {
    let ok = false;
    setState((prev) => {
      const baseTotal = getTotal(prev.selectedPlan, prev.selectedServices);
      if (!baseTotal) return prev;

      const redeeming = Boolean(prev.pendingVoucher && prev.voucher);
      const charge = redeeming ? 0 : baseTotal;

      // Balance guard: block a wash the wallet can't pay for (free redemptions
      // never overdraw). This replaces the old silent `Math.max(0, …)` floor.
      if (charge > prev.funds) return prev;
      ok = true;

      const shop = getCurrentShop(shopId);

      const booking = {
        id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        shopId: shop.id,
        shop: shop.name,
        dateId: prev.selectedDate,
        date: getSelectedDateLabel(
          prev.selectedDate,
          (key) => copy[prev.lang][key] ?? copy.en[key] ?? key
        ),
        time: prev.selectedTime,
        services: [...prev.selectedServices],
        total: charge,
        // Persist the plan the booking was priced under so later edits reprice
        // honestly instead of retroactively applying the current plan.
        plan: prev.selectedPlan,
        freeWash: redeeming,
        // Whether this booking granted a loyalty stamp, so cancel/delete can
        // reverse exactly what was awarded.
        earnedStamp: !redeeming,
        status: "upcoming"
      };

      if (redeeming) {
        // Consume the voucher and restart the 5-stamp loyalty card.
        return {
          ...prev,
          voucher: false,
          pendingVoucher: false,
          stamps: 0,
          booking,
          bookings: [booking, ...prev.bookings]
        };
      }

      const nextStamps = Math.min(5, prev.stamps + 1);
      return {
        ...prev,
        funds: prev.funds - charge,
        stamps: nextStamps,
        voucher: nextStamps >= 5,
        booking,
        bookings: [booking, ...prev.bookings]
      };
    });
    return ok;
  }, []);

  // Edit an upcoming booking's date / time / services. Reprices under the plan
  // the booking was made on (not the currently-selected plan) and adjusts the
  // wallet by the difference (refund if cheaper, charge if pricier). Returns
  // false when a price-raising edit can't be covered by the wallet.
  const updateBooking = useCallback((id, patch) => {
    let ok = false;
    setState((prev) => {
      const index = prev.bookings.findIndex((item) => item.id === id);
      if (index === -1) return prev;

      const existing = prev.bookings[index];
      const services = patch.services ?? existing.services;
      const dateId = patch.dateId ?? existing.dateId;
      const time = patch.time ?? existing.time;
      const plan = existing.plan ?? prev.selectedPlan;
      const newTotal = getTotal(plan, services);
      const date = dateId
        ? getSelectedDateLabel(dateId, (key) => copy[prev.lang][key] ?? copy.en[key] ?? key)
        : existing.date;

      const delta = existing.total - newTotal; // positive => refund, negative => charge
      // Block a pricier edit the wallet can't cover.
      if (delta < 0 && -delta > prev.funds) return prev;
      ok = true;

      const updated = { ...existing, services: [...services], dateId, time, date, total: newTotal };
      const bookings = [...prev.bookings];
      bookings[index] = updated;

      return {
        ...prev,
        funds: prev.funds + delta,
        bookings,
        booking: prev.booking?.id === id ? updated : prev.booking
      };
    });
    return ok;
  }, []);

  // Cancel an upcoming booking: mark it cancelled (moves to History), refund the
  // total, and reverse the loyalty stamp it granted (so book→cancel can't farm
  // free washes). The voucher relocks if stamps drop below 5.
  const cancelBooking = useCallback((id) => {
    setState((prev) => {
      const index = prev.bookings.findIndex((item) => item.id === id);
      if (index === -1) return prev;

      const existing = prev.bookings[index];
      if ((existing.status ?? "upcoming") !== "upcoming") return prev;

      const updated = { ...existing, status: "cancelled" };
      const bookings = [...prev.bookings];
      bookings[index] = updated;

      const nextStamps = Math.max(0, prev.stamps - (existing.earnedStamp ? 1 : 0));
      const stillUnlocked = nextStamps >= 5;

      return {
        ...prev,
        funds: prev.funds + existing.total,
        stamps: nextStamps,
        voucher: stillUnlocked,
        // A pending free-wash can't outlive the voucher that backs it.
        pendingVoucher: stillUnlocked ? prev.pendingVoucher : false,
        bookings,
        booking: prev.booking?.id === id ? updated : prev.booking
      };
    });
  }, []);

  // Remove a booking entirely. Refund + reverse its stamp only if it was still
  // an active (upcoming) reservation — completed/cancelled rows were already
  // settled (and a cancelled row already gave its stamp back).
  const deleteBooking = useCallback((id) => {
    setState((prev) => {
      const existing = prev.bookings.find((item) => item.id === id);
      if (!existing) return prev;

      const wasUpcoming = (existing.status ?? "upcoming") === "upcoming";
      const refund = wasUpcoming ? existing.total : 0;
      const nextStamps = Math.max(0, prev.stamps - (wasUpcoming && existing.earnedStamp ? 1 : 0));
      const stillUnlocked = nextStamps >= 5;

      return {
        ...prev,
        funds: prev.funds + refund,
        stamps: nextStamps,
        voucher: stillUnlocked,
        pendingVoucher: stillUnlocked ? prev.pendingVoucher : false,
        bookings: prev.bookings.filter((item) => item.id !== id),
        booking: prev.booking?.id === id ? null : prev.booking
      };
    });
  }, []);

  // Toggle a shop in the user's favourites (Heart). Persists via localStorage.
  const toggleFavorite = useCallback((shopId) => {
    setState((prev) => ({ ...prev, favorites: toggleItem(prev.favorites ?? [], shopId) }));
  }, []);

  const resetDemo = useCallback(() => {
    setState(initialState);
  }, []);

  const value = useMemo(
    () => ({
      state,
      hydrated,
      lang: state.lang,
      t,
      setLang,
      setSelectedPlan,
      topUpFunds,
      setVehicle,
      toggleService,
      setDate,
      setTime,
      confirmBooking,
      updateBooking,
      cancelBooking,
      deleteBooking,
      redeemVoucher,
      toggleFavorite,
      resetDemo
    }),
    [state, hydrated, t, setLang, setSelectedPlan, topUpFunds, setVehicle, toggleService, setDate, setTime, confirmBooking, updateBooking, cancelBooking, deleteBooking, redeemVoucher, toggleFavorite, resetDemo]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
