"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { copy } from "../data/copy.js";
import { createClient } from "./supabase/client.js";
import { DEMO_MODE, isDemo } from "./config.js";
import { getCatalog, setCatalog } from "./catalog-store.js";
import { resolveBookingIso } from "./calendar.js";
import {
  addFavorite,
  fetchBookings,
  fetchCatalog,
  fetchCoupon,
  fetchFavorites,
  fetchTransactions,
  removeFavorite,
  rpcCancelBooking,
  rpcCreateBooking,
  rpcUpdateBooking
} from "./data/api.js";
import {
  getCouponDiscount,
  getCurrentShop,
  getDiscount,
  getSelectedDateLabel,
  getSubtotal,
  getTotal,
  initialState,
  toggleItem
} from "./booking.js";
import { userLocation } from "../data/catalog.js";
import { formatDistanceKm, haversineKm } from "./data/adapters.js";
import { useGeolocation } from "./useGeolocation.js";

// Bump the version suffix when the persisted shape changes so returning users
// pick up the new defaults/seed data instead of stale state.
const STORAGE_KEY = "washgo:app-state-v3";

const AppContext = createContext(null);

// Backend mode starts EMPTY (no demo seed): signed-out users must sign in to
// book/favourite/top-up, and signed-in users get their real data from the DB.
// Demo mode keeps the original seeded initialState.
function blankState() {
  return {
    ...initialState,
    funds: 0,
    stamps: 0,
    voucher: false,
    pendingVoucher: false,
    bookings: [],
    favorites: [],
    booking: null,
    // No demo vehicle defaults in backend mode — a real user fills these in (and
    // the profile-completion reward depends on them actually being empty first).
    vehicle: { brand: "", model: "", plate: "", notes: "" },
    promo: null
  };
}

// Promo/referral codes available in demo mode (mirrors the seeded public.coupons
// rows so the offline demo can validate codes without a backend round-trip).
const DEMO_COUPONS = {
  WASHGO10: { code: "WASHGO10", percent: 10, amountOff: 0, description: "10% off your wash" },
  SEASON15: { code: "SEASON15", percent: 15, amountOff: 0, description: "Seasonal 15% off" },
  SHINE10: { code: "SHINE10", percent: 10, amountOff: 0, description: "10% off detailing" },
  CLEAN20K: { code: "CLEAN20K", percent: 0, amountOff: 20000, description: "20.000₫ off your wash" }
};

// Restore persisted demo state so refreshing mid-flow keeps tokens, stamps and
// the active booking. Only used in demo mode (backend mode is DB-driven).
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
  const supabase = useMemo(() => createClient(), []);
  // Demo vs backend. DEMO_MODE is a build-time constant (same on server and
  // client → hydration-safe); the `!supabase` fallback keeps a missing .env
  // from leaving a dead app. Treated as a constant for the provider's lifetime.
  const demo = useMemo(() => isDemo(supabase), [supabase]);

  // Seed the initial state from the build-time flag so a backend user never
  // flashes the demo balances. (DEMO_MODE is identical on server + client.)
  const [state, setState] = useState(() => (DEMO_MODE ? initialState : blankState()));
  // `hydrated` flips true once persisted/DB state has been read, so screens can
  // tell "no data yet" apart from "genuinely empty" (e.g. confirmation guard).
  const [hydrated, setHydrated] = useState(false);

  // Reference catalog (shops/services/plans). Seeded from the store (catalog.js
  // fallback) and replaced by the DB fetch in backend mode.
  const [catalog, setCatalogState] = useState(() => getCatalog());
  // The device's real location (falls back to the seed point until granted),
  // used to recompute shop distances so cards/lists reflect where the user
  // actually is rather than a fixed seed point. (#8)
  const liveLocation = useGeolocation(userLocation);
  const liveCatalog = useMemo(() => {
    if (!liveLocation || !catalog.shops?.length) return catalog;
    return {
      ...catalog,
      shops: catalog.shops.map((s) => {
        if (s.lat == null || s.lng == null) return s;
        const km = haversineKm(liveLocation, { lat: s.lat, lng: s.lng });
        return { ...s, distanceKm: km, distance: formatDistanceKm(km) };
      })
    };
  }, [catalog, liveLocation]);
  // Wallet ledger for the signed-in user (backend mode only).
  const [transactions, setTransactions] = useState([]);

  // Auth/session layer. `loading` is true until we've checked for an existing
  // session, so the UI can avoid flashing the signed-out state on refresh.
  const [auth, setAuth] = useState({ user: null, profile: null, loading: true });
  // Monotonic counter so a slow profile fetch from a superseded auth event can't
  // clobber the state set by a newer one (ordering-safe applySession).
  const authSeq = useRef(0);

  // Hydrate the starting state once mounted.
  useEffect(() => {
    if (demo) setState(loadInitialState());
    setHydrated(true);
  }, [demo]);

  // Backend: load the reference catalog from the DB (fall back to the seed in
  // the store on any error). Demo: the store seed is already correct.
  useEffect(() => {
    if (demo) {
      setCatalogState(getCatalog());
      return;
    }
    let active = true;
    fetchCatalog(supabase)
      .then((next) => {
        if (!active) return;
        setCatalog(next); // update the module store so booking.js helpers see it
        setCatalogState(next); // update context so components re-render
      })
      .catch((error) => {
        console.error("[washgo] catalog fetch failed; using seed", error);
      });
    return () => {
      active = false;
    };
  }, [demo, supabase]);

  // Backend: subscribe to auth changes. On sign-in we hydrate the user's
  // profile + bookings + favourites + wallet from the DB; on sign-out we drop to
  // the empty backend state. Demo mode skips auth entirely (pure local).
  useEffect(() => {
    if (demo) {
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
          setTransactions([]);
          setState((prev) => ({ ...blankState(), lang: prev.lang }));
        }
        return;
      }

      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      // A transient fetch failure would otherwise commit profile:null and make
      // an owner/admin look like a plain customer (and bounce them out of their
      // section). Retry once before giving up.
      if (profileError) {
        ({ data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single());
      }
      if (!active || mySeq !== authSeq.current) return;

      let bookings = [];
      let favorites = [];
      let ledger = [];
      try {
        [bookings, favorites, ledger] = await Promise.all([
          fetchBookings(supabase, user.id),
          fetchFavorites(supabase, user.id),
          fetchTransactions(supabase, user.id)
        ]);
      } catch (error) {
        console.error("[washgo] failed loading user data", error);
      }
      if (!active || mySeq !== authSeq.current) return;

      // Membership only counts while it hasn't lapsed: a lapsed 'premium' shows
      // as 'basic' so the client discount matches the server (which gates on
      // membership_until). Keeps a stale premium flag from showing a phantom 10%.
      const todayIso = new Date().toISOString().slice(0, 10);
      const activeMember =
        profile?.selected_plan === "premium" &&
        profile?.membership_until &&
        profile.membership_until >= todayIso;

      setAuth({ user, profile: profile ?? null, loading: false });
      setTransactions(ledger);
      setState((prev) => ({
        ...prev,
        funds: profile?.funds ?? 0,
        stamps: profile?.stamps ?? 0,
        voucher: profile?.voucher ?? false,
        pendingVoucher: profile?.pending_voucher ?? false,
        selectedPlan: activeMember ? "premium" : "basic",
        lang: profile?.lang ?? prev.lang,
        vehicle: { ...prev.vehicle, ...(profile?.vehicle ?? {}) },
        bookings,
        favorites
      }));
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
  }, [demo, supabase]);

  // Backend: persist the editable profile prefs (vehicle / language) only.
  // The membership tier (selected_plan) and balances (funds/stamps/voucher) are
  // server-authoritative and move ONLY through the RPCs (start_membership /
  // create_booking / …); writing selected_plan from this client-derived state
  // could clobber a valid membership back to 'basic' (#11), and the column is no
  // longer client-writable anyway.
  useEffect(() => {
    if (demo || !supabase || !auth.user) return;
    supabase
      .from("profiles")
      .update({
        vehicle: state.vehicle,
        lang: state.lang
      })
      .eq("id", auth.user.id)
      .then(() => {});
  }, [demo, supabase, auth.user, state.vehicle, state.lang]);

  // Demo: persist everything to localStorage as the offline source of truth.
  useEffect(() => {
    if (!demo || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [demo, state]);

  useEffect(() => {
    document.documentElement.lang = state.lang;
  }, [state.lang]);

  const t = useCallback(
    (key) => copy[state.lang][key] ?? copy.en[key] ?? key,
    [state.lang]
  );

  // Whether a write action needs the user to sign in first (backend + no user).
  const requireAuth = !demo && !auth.user;

  const refreshTransactions = useCallback(async () => {
    if (demo || !supabase || !auth.user) return;
    try {
      setTransactions(await fetchTransactions(supabase, auth.user.id));
    } catch (error) {
      console.error("[washgo] failed loading transactions", error);
    }
  }, [demo, supabase, auth.user]);

  // Reflect server-authoritative balances into both `state` and the cached
  // auth.profile after a money/loyalty RPC.
  const syncBalances = useCallback((patch) => {
    setState((prev) => ({ ...prev, ...patch }));
    setAuth((prev) =>
      prev.profile ? { ...prev, profile: { ...prev.profile, ...balanceColumns(patch) } } : prev
    );
  }, []);

  // Re-pull server-authoritative account state (profile balances, bookings,
  // wallet history). Used after returning from the hosted PayOS checkout, where
  // the WEBHOOK — not the browser — has applied the change. Returns the fresh
  // profile so the success page can poll until the top-up/booking has landed.
  const refreshAccount = useCallback(async () => {
    if (demo || !supabase) return null;
    // Resolve the user directly rather than via auth.user — this is called right
    // after the cross-site PayOS redirect, where onAuthStateChange may not have
    // repopulated React auth state yet (otherwise it would read a stale null and
    // skip the refresh, leaving the success page showing pre-payment balances).
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) return null;
    try {
      const [{ data: profile }, bookings, ledger] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        fetchBookings(supabase, user.id),
        fetchTransactions(supabase, user.id)
      ]);
      const todayIso = new Date().toISOString().slice(0, 10);
      const activeMember =
        profile?.selected_plan === "premium" &&
        profile?.membership_until &&
        profile.membership_until >= todayIso;
      if (profile) setAuth((prev) => ({ ...prev, profile }));
      setTransactions(ledger);
      setState((prev) => ({
        ...prev,
        funds: profile?.funds ?? prev.funds,
        stamps: profile?.stamps ?? prev.stamps,
        voucher: profile?.voucher ?? prev.voucher,
        pendingVoucher: profile?.pending_voucher ?? prev.pendingVoucher,
        selectedPlan: activeMember ? "premium" : "basic",
        bookings
      }));
      return profile ?? null;
    } catch (error) {
      console.error("[washgo] refreshAccount failed", error);
      return null;
    }
  }, [demo, supabase]);

  // ---- Preference actions (identical in both modes) -----------------------

  const setLang = useCallback((lang) => {
    setState((prev) => ({ ...prev, lang }));
  }, []);

  const setSelectedPlan = useCallback((selectedPlan) => {
    setState((prev) => ({ ...prev, selectedPlan }));
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
  const redeemVoucher = useCallback(() => {
    setState((prev) => (prev.voucher ? { ...prev, pendingVoucher: true } : prev));
  }, []);

  // ---- Promo / referral codes --------------------------------------------

  // Validate a code and stash the resulting coupon so checkout can price it. The
  // server re-validates and re-prices on confirm, so a tampered client can't pay
  // less. Returns true when the code is accepted.
  const applyPromo = useCallback(
    async (code) => {
      const clean = String(code ?? "").trim().toUpperCase();
      if (!clean) return false;
      if (demo) {
        const coupon = DEMO_COUPONS[clean];
        if (!coupon) return false;
        setState((prev) => ({ ...prev, promo: coupon }));
        return true;
      }
      try {
        const coupon = await fetchCoupon(supabase, clean);
        if (!coupon) return false;
        setState((prev) => ({ ...prev, promo: coupon }));
        return true;
      } catch (error) {
        console.error("[washgo] fetchCoupon failed", error);
        return false;
      }
    },
    [demo, supabase]
  );

  const clearPromo = useCallback(() => setState((prev) => ({ ...prev, promo: null })), []);

  // ---- Profile-completion reward -----------------------------------------

  // Has the user filled in the personal + vehicle details the free-wash reward
  // needs? Mirrors the server's profile_is_complete (name, phone, model, plate).
  const profileComplete = Boolean(
    String(auth.profile?.full_name || "").trim() &&
      String(auth.profile?.phone || "").trim() &&
      String(auth.profile?.car_model || state.vehicle?.model || "").trim() &&
      String(state.vehicle?.plate || "").trim()
  );
  const profileRewardClaimed = Boolean(auth.profile?.profile_reward_claimed);

  // Claim the one-time free-wash voucher once the profile is complete. The server
  // re-validates and is idempotent; returns true when a voucher was newly granted.
  const claimProfileReward = useCallback(async () => {
    if (demo) {
      let granted = false;
      setState((prev) => {
        if (prev.voucher) return prev;
        granted = true;
        return { ...prev, voucher: true };
      });
      return granted;
    }
    if (!supabase || !auth.user) return false;
    try {
      const { data, error } = await supabase.rpc("complete_profile_reward");
      if (error) throw error;
      const voucher = Boolean(data?.voucher);
      const stamps = data?.stamps;
      setState((prev) => ({ ...prev, voucher, stamps: stamps ?? prev.stamps }));
      setAuth((prev) =>
        prev.profile
          ? { ...prev, profile: { ...prev.profile, voucher, profile_reward_claimed: true } }
          : prev
      );
      return Boolean(data?.granted);
    } catch (error) {
      console.error("[washgo] complete_profile_reward failed", error);
      return false;
    }
  }, [demo, supabase, auth.user]);

  // ---- Wallet -------------------------------------------------------------

  const topUpFunds = useCallback(
    async (amount) => {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) return false;

      if (demo) {
        setState((prev) => ({ ...prev, funds: prev.funds + Math.round(value) }));
        return true;
      }
      // Backend: real top-ups go through the hosted PayOS checkout (startCheckout)
      // and are credited by the webhook — the client can no longer mint funds
      // (top_up is revoked). Screens call startCheckout directly; this guard just
      // catches any stray legacy caller.
      console.warn("[washgo] topUpFunds is no-op in backend mode — use the gateway checkout");
      return false;
    },
    [demo]
  );

  // ---- Membership ---------------------------------------------------------

  // Join / renew the monthly membership (premium plan + a renewal date). Charges
  // the fee from the wallet. Server-defined fee; demo mirrors it locally.
  const MEMBERSHIP_FEE = 199000;
  const startMembership = useCallback(async () => {
    if (demo) {
      let ok = false;
      setState((prev) => {
        if (prev.funds < MEMBERSHIP_FEE) return prev;
        ok = true;
        return { ...prev, funds: prev.funds - MEMBERSHIP_FEE, selectedPlan: "premium" };
      });
      return ok;
    }
    if (!supabase || !auth.user) return false;
    try {
      const res = await supabase.rpc("start_membership");
      if (res.error) throw res.error;
      const { funds, membership_until } = res.data ?? {};
      setState((prev) => ({ ...prev, funds: funds ?? prev.funds, selectedPlan: "premium" }));
      setAuth((prev) =>
        prev.profile
          ? { ...prev, profile: { ...prev.profile, funds, selected_plan: "premium", membership_until } }
          : prev
      );
      await refreshTransactions();
      return true;
    } catch (error) {
      console.error("[washgo] start_membership failed", error);
      return false;
    }
  }, [demo, supabase, auth.user, refreshTransactions]);

  // ---- Bookings -----------------------------------------------------------

  const confirmBooking = useCallback(
    async (shopId, serviceIdsArg) => {
      if (demo) {
        let ok = false;
        setState((prev) => {
          const ids = serviceIdsArg ?? prev.selectedServices;
          const subtotal = getSubtotal(ids);
          if (subtotal <= 0) return prev;
          const standardId = getCurrentShop(shopId)?.standardServiceId || "exterior";
          // The free-wash voucher only engages when the shop's standard car wash is
          // in the cart, and it covers ONLY that wash — extras are still charged.
          const redeeming = Boolean(prev.pendingVoucher && prev.voucher && ids.includes(standardId));
          const membershipDiscount = getDiscount(prev.selectedPlan, ids);
          const couponDiscount = redeeming ? 0 : getCouponDiscount(prev.promo, subtotal, membershipDiscount);
          const baseTotal = Math.max(0, subtotal - membershipDiscount - couponDiscount);
          const freeWashAmount = redeeming ? getSubtotal([standardId]) : 0;
          const charge = Math.max(0, baseTotal - freeWashAmount);
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
            services: [...ids],
            total: charge,
            plan: prev.selectedPlan,
            freeWash: redeeming,
            earnedStamp: !redeeming,
            // Remember the coupon basis so an edit re-prices with it (#12).
            coupon: !redeeming && couponDiscount > 0 ? prev.promo : null,
            status: "upcoming"
          };
          if (redeeming) {
            return {
              ...prev,
              // Voucher covers the standard wash; still pay for any extra services.
              funds: prev.funds - charge,
              voucher: false,
              pendingVoucher: false,
              stamps: 0,
              promo: null,
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
            promo: null,
            booking,
            bookings: [booking, ...prev.bookings]
          };
        });
        return ok;
      }

      // Backend
      if (!auth.user) return false;
      const serviceIds = serviceIdsArg ?? state.selectedServices;
      if (!serviceIds.length) return false;
      // The voucher only applies when the shop's standard car wash is in the cart
      // (the server requires it and charges for any extra services).
      const standardId = getCurrentShop(shopId)?.standardServiceId || "exterior";
      const useVoucher = Boolean(state.pendingVoucher && state.voucher && serviceIds.includes(standardId));
      try {
        const res = await rpcCreateBooking(supabase, {
          shopId,
          date: resolveBookingIso(state.selectedDate),
          slot: state.selectedTime,
          serviceIds,
          useVoucher,
          couponCode: useVoucher ? null : state.promo?.code
        });
        const bookings = await fetchBookings(supabase, auth.user.id);
        const booking = bookings.find((b) => b.id === res.booking_id) ?? bookings[0] ?? null;
        setState((prev) => ({
          ...prev,
          funds: res.funds,
          stamps: res.stamps,
          voucher: res.voucher,
          pendingVoucher: useVoucher ? false : prev.pendingVoucher,
          promo: null,
          bookings,
          booking
        }));
        setAuth((prev) =>
          prev.profile
            ? { ...prev, profile: { ...prev.profile, funds: res.funds, stamps: res.stamps, voucher: res.voucher } }
            : prev
        );
        await refreshTransactions();
        return true;
      } catch (error) {
        console.error("[washgo] create_booking failed", error);
        return false;
      }
    },
    [demo, supabase, auth.user, state.selectedServices, state.selectedDate, state.selectedTime, state.pendingVoucher, state.voucher, state.promo, refreshTransactions]
  );

  const updateBooking = useCallback(
    async (id, patch) => {
      if (demo) {
        let ok = false;
        setState((prev) => {
          const index = prev.bookings.findIndex((item) => item.id === id);
          if (index === -1) return prev;
          const existing = prev.bookings[index];
          const services = patch.services ?? existing.services;
          const dateId = patch.dateId ?? existing.dateId;
          const time = patch.time ?? existing.time;
          const plan = existing.plan ?? prev.selectedPlan;
          // Re-apply the booking's original coupon and free-wash status so an
          // unrelated date/time edit doesn't silently re-charge it (#12).
          const membershipDiscount = getDiscount(plan, services);
          const couponDiscount = existing.coupon
            ? getCouponDiscount(existing.coupon, getSubtotal(services), membershipDiscount)
            : 0;
          const baseTotal = Math.max(0, getSubtotal(services) - membershipDiscount - couponDiscount);
          // A free-wash booking keeps the standard wash free on edit (when it's
          // still selected); everything else is charged.
          const newTotal =
            existing.freeWash && services.includes("exterior")
              ? Math.max(0, baseTotal - getSubtotal(["exterior"]))
              : baseTotal;
          const date = dateId
            ? getSelectedDateLabel(dateId, (key) => copy[prev.lang][key] ?? copy.en[key] ?? key)
            : existing.date;
          const delta = existing.total - newTotal;
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
      }

      // Backend
      if (!auth.user) return false;
      const existing = state.bookings.find((item) => item.id === id);
      if (!existing) return false;
      const services = patch.services ?? existing.services;
      const dateId = patch.dateId ?? existing.dateId;
      const slot = patch.time ?? existing.time;
      try {
        const res = await rpcUpdateBooking(supabase, {
          bookingId: id,
          date: resolveBookingIso(dateId),
          slot,
          serviceIds: services
        });
        const bookings = await fetchBookings(supabase, auth.user.id);
        setState((prev) => ({
          ...prev,
          funds: res.funds,
          bookings,
          booking: prev.booking?.id === id ? bookings.find((b) => b.id === id) ?? prev.booking : prev.booking
        }));
        setAuth((prev) =>
          prev.profile ? { ...prev, profile: { ...prev.profile, funds: res.funds } } : prev
        );
        await refreshTransactions();
        return true;
      } catch (error) {
        console.error("[washgo] update_booking failed", error);
        return false;
      }
    },
    [demo, supabase, auth.user, state.bookings, refreshTransactions]
  );

  const cancelBooking = useCallback(
    async (id) => {
      if (demo) {
        setState((prev) => {
          const index = prev.bookings.findIndex((item) => item.id === id);
          if (index === -1) return prev;
          const existing = prev.bookings[index];
          if ((existing.status ?? "upcoming") !== "upcoming") return prev;
          const updated = { ...existing, status: "cancelled" };
          const bookings = [...prev.bookings];
          bookings[index] = updated;
          // A free-wash booking consumed the voucher (stamps were already reset on
          // redeem). On cancel, give the voucher back rather than destroying the
          // hard-earned reward (#10). Otherwise reverse the stamp it granted.
          const nextStamps = Math.max(0, prev.stamps - (existing.earnedStamp ? 1 : 0));
          const voucher = existing.freeWash ? true : nextStamps >= 5;
          return {
            ...prev,
            funds: prev.funds + existing.total,
            stamps: nextStamps,
            voucher,
            pendingVoucher: existing.freeWash ? false : voucher ? prev.pendingVoucher : false,
            bookings,
            booking: prev.booking?.id === id ? updated : prev.booking
          };
        });
        return;
      }

      // Backend
      if (!auth.user) return;
      try {
        const res = await rpcCancelBooking(supabase, id);
        const bookings = await fetchBookings(supabase, auth.user.id);
        setState((prev) => ({
          ...prev,
          funds: res.funds,
          stamps: res.stamps,
          voucher: res.voucher,
          pendingVoucher: res.voucher ? prev.pendingVoucher : false,
          bookings,
          booking: prev.booking?.id === id ? bookings.find((b) => b.id === id) ?? null : prev.booking
        }));
        setAuth((prev) =>
          prev.profile
            ? { ...prev, profile: { ...prev.profile, funds: res.funds, stamps: res.stamps, voucher: res.voucher } }
            : prev
        );
        await refreshTransactions();
      } catch (error) {
        console.error("[washgo] cancel_booking failed", error);
      }
    },
    [demo, supabase, auth.user, refreshTransactions]
  );

  const deleteBooking = useCallback(
    async (id) => {
      if (demo) {
        setState((prev) => {
          const existing = prev.bookings.find((item) => item.id === id);
          if (!existing) return prev;
          const wasUpcoming = (existing.status ?? "upcoming") === "upcoming";
          const refund = wasUpcoming ? existing.total : 0;
          const nextStamps = Math.max(0, prev.stamps - (wasUpcoming && existing.earnedStamp ? 1 : 0));
          // Restore the voucher when deleting an upcoming free-wash booking (#10).
          const voucher = wasUpcoming && existing.freeWash ? true : nextStamps >= 5;
          return {
            ...prev,
            funds: prev.funds + refund,
            stamps: nextStamps,
            voucher,
            pendingVoucher: wasUpcoming && existing.freeWash ? false : voucher ? prev.pendingVoucher : false,
            bookings: prev.bookings.filter((item) => item.id !== id),
            booking: prev.booking?.id === id ? null : prev.booking
          };
        });
        return;
      }

      // Backend: history cleanup. The UI only deletes completed/cancelled rows
      // (upcoming ones go through cancel first), so no refund is applied here.
      if (!auth.user) return;
      try {
        const { error } = await supabase
          .from("bookings")
          .delete()
          .eq("id", id)
          .eq("user_id", auth.user.id);
        if (error) throw error;
        const bookings = await fetchBookings(supabase, auth.user.id);
        setState((prev) => ({
          ...prev,
          bookings,
          booking: prev.booking?.id === id ? null : prev.booking
        }));
      } catch (error) {
        console.error("[washgo] delete booking failed", error);
      }
    },
    [demo, supabase, auth.user]
  );

  // ---- Favourites ---------------------------------------------------------

  const toggleFavorite = useCallback(
    async (shopId) => {
      if (demo) {
        setState((prev) => ({ ...prev, favorites: toggleItem(prev.favorites ?? [], shopId) }));
        return;
      }
      if (!auth.user) return;
      const had = (state.favorites ?? []).includes(shopId);
      setState((prev) => ({ ...prev, favorites: toggleItem(prev.favorites ?? [], shopId) }));
      try {
        if (had) await removeFavorite(supabase, auth.user.id, shopId);
        else await addFavorite(supabase, auth.user.id, shopId);
      } catch (error) {
        console.error("[washgo] favourite sync failed", error);
        // Revert the optimistic toggle.
        setState((prev) => ({ ...prev, favorites: toggleItem(prev.favorites ?? [], shopId) }));
      }
    },
    [demo, supabase, auth.user, state.favorites]
  );

  // ---- Session ------------------------------------------------------------

  const resetDemo = useCallback(() => {
    setState((prev) => ({ ...(demo ? initialState : blankState()), lang: prev.lang }));
  }, [demo]);

  const signOut = useCallback(async () => {
    // scope:"global" revokes the refresh token everywhere, not just this tab, so
    // a stale session can't be reused after sign-out. Wrapped so a network error
    // on the revoke call doesn't skip the local cleanup below.
    try {
      if (supabase) await supabase.auth.signOut({ scope: "global" });
    } catch (error) {
      console.error("[washgo] sign-out revoke failed; clearing locally", error);
    }
    // Drop our own cached app state so the next user doesn't inherit it.
    if (typeof window !== "undefined") {
      try {
        Object.keys(window.localStorage)
          .filter((key) => key.startsWith("washgo:"))
          .forEach((key) => window.localStorage.removeItem(key));
      } catch {
        /* ignore quota / private-mode errors */
      }
    }
    // Clear auth state explicitly rather than relying solely on the SIGNED_OUT
    // event firing — otherwise a failed revoke could leave the UI "signed in".
    setAuth({ user: null, profile: null, loading: false });
    setTransactions([]);
    setState((prev) => ({ ...(demo ? initialState : blankState()), lang: prev.lang }));
  }, [supabase, demo]);

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

  // Apply to become a car-wash owner. The RPC flips owner_status to 'pending';
  // we re-read the profile so the account UI reflects it immediately.
  const applyForOwner = useCallback(async () => {
    if (!supabase || !auth.user) return { error: "Not signed in" };
    const { error } = await supabase.rpc("apply_for_owner");
    if (error) return { error: error.message };
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", auth.user.id)
      .single();
    if (data) setAuth((prev) => ({ ...prev, profile: data }));
    return { error: null };
  }, [supabase, auth.user]);

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
      hydrated,
      lang: state.lang,
      auth,
      mode: demo ? "demo" : "backend",
      requireAuth,
      catalog: liveCatalog,
      liveLocation,
      transactions,
      refreshTransactions,
      refreshAccount,
      signOut,
      updateProfile,
      uploadAvatar,
      applyForOwner,
      t,
      setLang,
      setSelectedPlan,
      topUpFunds,
      startMembership,
      setVehicle,
      toggleService,
      setDate,
      setTime,
      confirmBooking,
      updateBooking,
      cancelBooking,
      deleteBooking,
      redeemVoucher,
      applyPromo,
      clearPromo,
      promo: state.promo,
      profileComplete,
      profileRewardClaimed,
      claimProfileReward,
      toggleFavorite,
      resetDemo
    }),
    [
      state,
      hydrated,
      auth,
      demo,
      requireAuth,
      liveCatalog,
      liveLocation,
      transactions,
      refreshTransactions,
      refreshAccount,
      signOut,
      updateProfile,
      uploadAvatar,
      applyForOwner,
      t,
      setLang,
      setSelectedPlan,
      topUpFunds,
      startMembership,
      setVehicle,
      toggleService,
      setDate,
      setTime,
      confirmBooking,
      updateBooking,
      cancelBooking,
      deleteBooking,
      redeemVoucher,
      applyPromo,
      clearPromo,
      profileComplete,
      profileRewardClaimed,
      claimProfileReward,
      toggleFavorite,
      resetDemo
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Map the state balance keys we just set back to their profiles column names.
function balanceColumns(patch) {
  const out = {};
  if ("funds" in patch) out.funds = patch.funds;
  if ("stamps" in patch) out.stamps = patch.stamps;
  if ("voucher" in patch) out.voucher = patch.voucher;
  return out;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
