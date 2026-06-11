"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { copy } from "../data/copy.js";
import { createClient } from "./supabase/client.js";
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

  // Auth/session layer. `loading` is true until we've checked for an existing
  // session, so the UI can avoid flashing the signed-out state on refresh.
  const [auth, setAuth] = useState({ user: null, profile: null, loading: true });
  const supabase = useMemo(() => createClient(), []);
  // Monotonic counter so a slow profile fetch from a superseded auth event can't
  // clobber the state set by a newer one (ordering-safe applySession).
  const authSeq = useRef(0);

  useEffect(() => {
    setState(loadInitialState());
  }, []);

  // Subscribe to auth changes. On sign-in we load the user's `profiles` row and
  // hydrate per-user balances from it (source of truth when signed in); on
  // sign-out we fall back to the local/demo state.
  useEffect(() => {
    // Supabase not configured (no env) — stay in signed-out demo mode.
    if (!supabase) {
      setAuth({ user: null, profile: null, loading: false });
      return;
    }

    let active = true;

    async function applySession(session) {
      const mySeq = ++authSeq.current;
      const user = session?.user ?? null;
      if (!user) {
        if (active) {
          setAuth({ user: null, profile: null, loading: false });
          // No signed-in user → drop any personal balances left over from a
          // previous session or the localStorage cache. Signed-out is empty.
          setState((prev) => ({
            ...prev,
            tokens: 0,
            stamps: 0,
            voucher: false,
            booking: null
          }));
        }
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      // Bail if unmounted, or a newer auth event has since superseded this one
      // (prevents a stale fetch from overwriting fresher state).
      if (!active || mySeq !== authSeq.current) return;
      setAuth({ user, profile: profile ?? null, loading: false });
      if (profile) {
        setState((prev) => ({
          ...prev,
          tokens: profile.tokens ?? prev.tokens,
          stamps: profile.stamps ?? prev.stamps,
          voucher: profile.voucher ?? prev.voucher,
          selectedPlan: profile.selected_plan ?? prev.selectedPlan,
          vehicle: { ...prev.vehicle, ...(profile.vehicle ?? {}) }
        }));
      }
    }

    // onAuthStateChange emits INITIAL_SESSION immediately on subscribe, so a
    // separate getSession() call would be redundant (and a late-resolving one
    // could clobber a fresher SIGNED_IN). The listener is the single source.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Persist per-user balances back to Supabase when signed in. localStorage
  // (below) still runs as an offline cache.
  useEffect(() => {
    if (!supabase || !auth.user) return;
    supabase
      .from("profiles")
      .update({
        tokens: state.tokens,
        stamps: state.stamps,
        voucher: state.voucher,
        selected_plan: state.selectedPlan,
        vehicle: state.vehicle
      })
      .eq("id", auth.user.id)
      .then(() => {});
  }, [supabase, auth.user, state.tokens, state.stamps, state.voucher, state.selectedPlan, state.vehicle]);

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

  // Keep the language preference when wiping domain state.
  const resetDemo = useCallback(() => {
    setState((prev) => ({ ...initialState, lang: prev.lang }));
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    // Drop back to the local demo state so balances aren't left showing the
    // signed-out user's account data.
    setState((prev) => ({ ...initialState, lang: prev.lang }));
  }, [supabase]);

  // Patch the signed-in user's profile row (e.g. full_name, avatar_url) and
  // sync the result into local auth state. Returns { error } for the caller.
  const updateProfile = useCallback(
    async (patch) => {
      if (!supabase || !auth.user) return { error: "Not signed in" };
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", auth.user.id)
        .select()
        .single();
      if (!error) setAuth((prev) => ({ ...prev, profile: data }));
      return { error: error?.message ?? null };
    },
    [supabase, auth.user]
  );

  // Upload an avatar image to the public `avatars` bucket under the user's id,
  // then store its URL on the profile. Cache-busts the URL so the new image
  // shows immediately.
  const uploadAvatar = useCallback(
    async (file) => {
      if (!supabase || !auth.user) return { error: "Not signed in" };
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${auth.user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) return { error: uploadError.message };
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      return updateProfile({ avatar_url: url });
    },
    [supabase, auth.user, updateProfile]
  );

  const value = useMemo(
    () => ({
      state,
      lang: state.lang,
      auth,
      signOut,
      updateProfile,
      uploadAvatar,
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
    [state, auth, signOut, updateProfile, uploadAvatar, t, setLang, setSelectedPlan, continuePlan, setVehicle, toggleService, setDate, setTime, confirmBooking, resetDemo]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
