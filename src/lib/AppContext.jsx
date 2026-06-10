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

const STORAGE_KEY = "washgo:app-state";

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

  // Grant the plan's token balance (membership purchase).
  const continuePlan = useCallback(() => {
    setState((prev) => ({
      ...prev,
      tokens: prev.selectedPlan === "premium" ? 100 : 50
    }));
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

      return {
        ...prev,
        tokens: Math.max(0, prev.tokens - total),
        stamps: nextStamps,
        voucher: nextStamps >= 5,
        booking: {
          shopId: shop.id,
          shop: shop.name,
          date: getSelectedDateLabel(
            prev.selectedDate,
            (key) => copy[prev.lang][key] ?? copy.en[key] ?? key
          ),
          time: prev.selectedTime,
          total
        }
      };
    });
    return ok;
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
      continuePlan,
      setVehicle,
      toggleService,
      setDate,
      setTime,
      confirmBooking,
      resetDemo
    }),
    [state, t, setLang, setSelectedPlan, continuePlan, setVehicle, toggleService, setDate, setTime, confirmBooking, resetDemo]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
