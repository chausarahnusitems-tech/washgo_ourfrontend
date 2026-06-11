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
const STORAGE_KEY = "washgo:app-state-v2";

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

  useEffect(() => {
    setState(loadInitialState());
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

  // Confirm a booking for the shop named by the current route. Returns false
  // when there's nothing to charge (no services selected) so the caller can
  // avoid navigating to the confirmation screen.
  const confirmBooking = useCallback((shopId) => {
    let ok = false;
    setState((prev) => {
      const total = getTotal(prev.selectedPlan, prev.selectedServices);
      if (!total) return prev;
      ok = true;

      const shop = getCurrentShop(shopId);
      const nextStamps = Math.min(5, prev.stamps + 1);

      const booking = {
        id: `bk-${prev.bookings.length + 1}-${Date.now()}`,
        shopId: shop.id,
        shop: shop.name,
        dateId: prev.selectedDate,
        date: getSelectedDateLabel(
          prev.selectedDate,
          (key) => copy[prev.lang][key] ?? copy.en[key] ?? key
        ),
        time: prev.selectedTime,
        services: [...prev.selectedServices],
        total,
        status: "upcoming"
      };

      return {
        ...prev,
        funds: Math.max(0, prev.funds - total),
        stamps: nextStamps,
        voucher: nextStamps >= 5,
        booking,
        bookings: [booking, ...prev.bookings]
      };
    });
    return ok;
  }, []);

  // Edit an upcoming booking's date / time / services. Recomputes the total and
  // adjusts the wallet by the difference (refund if cheaper, charge if pricier).
  const updateBooking = useCallback((id, patch) => {
    setState((prev) => {
      const index = prev.bookings.findIndex((item) => item.id === id);
      if (index === -1) return prev;

      const existing = prev.bookings[index];
      const services = patch.services ?? existing.services;
      const dateId = patch.dateId ?? existing.dateId;
      const time = patch.time ?? existing.time;
      const newTotal = getTotal(prev.selectedPlan, services);
      const date = dateId
        ? getSelectedDateLabel(dateId, (key) => copy[prev.lang][key] ?? copy.en[key] ?? key)
        : existing.date;

      const updated = { ...existing, services: [...services], dateId, time, date, total: newTotal };
      const delta = existing.total - newTotal; // positive => refund, negative => charge

      const bookings = [...prev.bookings];
      bookings[index] = updated;

      return {
        ...prev,
        funds: Math.max(0, prev.funds + delta),
        bookings,
        booking: prev.booking?.id === id ? updated : prev.booking
      };
    });
  }, []);

  // Cancel an upcoming booking: mark it cancelled (moves to History) and refund
  // the total back to the wallet.
  const cancelBooking = useCallback((id) => {
    setState((prev) => {
      const index = prev.bookings.findIndex((item) => item.id === id);
      if (index === -1) return prev;

      const existing = prev.bookings[index];
      if ((existing.status ?? "upcoming") !== "upcoming") return prev;

      const updated = { ...existing, status: "cancelled" };
      const bookings = [...prev.bookings];
      bookings[index] = updated;

      return {
        ...prev,
        funds: prev.funds + existing.total,
        bookings,
        booking: prev.booking?.id === id ? updated : prev.booking
      };
    });
  }, []);

  // Remove a booking entirely. Refund only if it was still an active (upcoming)
  // reservation — completed/cancelled rows were already settled.
  const deleteBooking = useCallback((id) => {
    setState((prev) => {
      const existing = prev.bookings.find((item) => item.id === id);
      if (!existing) return prev;

      const refund = (existing.status ?? "upcoming") === "upcoming" ? existing.total : 0;

      return {
        ...prev,
        funds: prev.funds + refund,
        bookings: prev.bookings.filter((item) => item.id !== id),
        booking: prev.booking?.id === id ? null : prev.booking
      };
    });
  }, []);

  const resetDemo = useCallback(() => {
    setState(initialState);
  }, []);

  const value = useMemo(
    () => ({
      state,
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
      resetDemo
    }),
    [state, t, setLang, setSelectedPlan, topUpFunds, setVehicle, toggleService, setDate, setTime, confirmBooking, updateBooking, cancelBooking, deleteBooking, resetDemo]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
