import { useCallback, useEffect, useMemo, useState } from "react";
import { copy } from "./data/copy.js";
import { shops, services as serviceCatalog } from "./data/catalog.js";
import {
  getCurrentShop,
  getSelectedDateLabel,
  getTotal,
  initialState,
  toggleItem
} from "./lib/booking.js";
import { DeviceShell } from "./components/layout/DeviceShell.jsx";
import { Button } from "./components/ui/Button.jsx";
import { ShopCard } from "./components/ShopCard.jsx";
import { PlansScreen } from "./screens/PlansScreen.jsx";
import { HomeScreen } from "./screens/HomeScreen.jsx";
import { ExploreScreen } from "./screens/ExploreScreen.jsx";
import { DetailScreen } from "./screens/DetailScreen.jsx";
import { BookingScreen } from "./screens/BookingScreen.jsx";
import { ConfirmationScreen } from "./screens/ConfirmationScreen.jsx";
import { BookingsScreen } from "./screens/BookingsScreen.jsx";
import { RewardsScreen } from "./screens/RewardsScreen.jsx";
import { VouchersScreen } from "./screens/VouchersScreen.jsx";
import { AccountScreen } from "./screens/AccountScreen.jsx";

// Controls the mobile bottom-nav highlight + presence. Screens absent from
// this map (detail, booking, confirmation, explore, plans) render their own
// footer / are desktop-only, so they show no bottom nav.
const bottomNavByScreen = {
  home: "home",
  bookings: "bookings",
  rewards: "account",
  vouchers: "account",
  account: "account"
};

// Controls the desktop top-nav highlight.
const topNavByScreen = {
  explore: "explore",
  detail: "explore",
  bookings: "bookings",
  account: "account"
};

export default function App() {
  const [state, setState] = useState(initialState);

  const t = useCallback(
    (key) => copy[state.lang][key] ?? copy.en[key] ?? key,
    [state.lang]
  );

  const currentShop = useMemo(() => getCurrentShop(state.selectedShop), [state.selectedShop]);
  const quickShop = useMemo(
    () => shops.find((shop) => shop.id === state.quickShop),
    [state.quickShop]
  );

  useEffect(() => {
    document.documentElement.lang = state.lang;
  }, [state.lang]);

  const setScreen = useCallback((screen) => {
    setState((prev) => ({ ...prev, screen, quickShop: null, mapShop: null }));
  }, []);

  const setLang = useCallback((lang) => {
    setState((prev) => ({ ...prev, lang }));
  }, []);

  const goHome = useCallback(() => setScreen("home"), [setScreen]);

  const selectPlan = useCallback((selectedPlan) => {
    setState((prev) => ({ ...prev, selectedPlan }));
  }, []);

  const continuePlan = useCallback(() => {
    setState((prev) => {
      const tokens = prev.selectedPlan === "premium" ? 100 : 50;
      return { ...prev, tokens, screen: "home" };
    });
  }, []);

  const selectShop = useCallback((selectedShop) => {
    setState((prev) => ({ ...prev, selectedShop, screen: "detail", quickShop: null }));
  }, []);

  const startBooking = useCallback(() => {
    setState((prev) => ({ ...prev, screen: "booking", quickShop: null }));
  }, []);

  const goExplore = useCallback(() => setScreen("explore"), [setScreen]);

  // Jump to the map page pre-filtered by a service (home service tiles).
  const exploreService = useCallback((serviceId) => {
    const seed = serviceCatalog.some((service) => service.id === serviceId) ? serviceId : "";
    setState((prev) => ({ ...prev, screen: "explore", search: seed, quickShop: null, mapShop: null }));
  }, []);

  const setSearch = useCallback((search) => {
    setState((prev) => ({ ...prev, search }));
  }, []);

  // Map page: select a shop to surface its detail card (does not navigate).
  const setMapShop = useCallback((mapShop) => {
    setState((prev) => ({ ...prev, mapShop }));
  }, []);

  const closeMapShop = useCallback(() => {
    setState((prev) => ({ ...prev, mapShop: null }));
  }, []);

  // "Book Now" from the map detail card -> straight into booking.
  const bookShop = useCallback((selectedShop) => {
    setState((prev) => ({ ...prev, selectedShop, screen: "booking", quickShop: null, mapShop: null }));
  }, []);

  const setQuickShop = useCallback((quickShop) => {
    setState((prev) => ({ ...prev, quickShop }));
  }, []);

  const closeQuickShop = useCallback(() => {
    setState((prev) => ({ ...prev, quickShop: null }));
  }, []);

  const setDate = useCallback((selectedDate) => {
    setState((prev) => ({ ...prev, selectedDate }));
  }, []);

  const setTime = useCallback((selectedTime) => {
    setState((prev) => ({ ...prev, selectedTime }));
  }, []);

  const toggleService = useCallback((serviceId) => {
    setState((prev) => ({
      ...prev,
      selectedServices: toggleItem(prev.selectedServices, serviceId)
    }));
  }, []);

  const setVehicle = useCallback((patch) => {
    setState((prev) => ({ ...prev, vehicle: { ...prev.vehicle, ...patch } }));
  }, []);

  const confirmBooking = useCallback(() => {
    setState((prev) => {
      const total = getTotal(prev.selectedPlan, prev.selectedServices);
      if (!total) return prev;

      const shop = getCurrentShop(prev.selectedShop);
      const nextStamps = Math.min(5, prev.stamps + 1);

      return {
        ...prev,
        tokens: Math.max(0, prev.tokens - total),
        stamps: nextStamps,
        voucher: nextStamps >= 5,
        booking: {
          shop: shop.name,
          date: getSelectedDateLabel(prev.selectedDate, (key) => copy[prev.lang][key] ?? copy.en[key] ?? key),
          time: prev.selectedTime,
          total
        },
        screen: "confirmation",
        quickShop: null
      };
    });
  }, []);

  const resetDemo = useCallback(() => {
    setState(initialState);
  }, []);

  const screen = (() => {
    switch (state.screen) {
      case "plans":
        return (
          <PlansScreen
            state={state}
            t={t}
            onLang={setLang}
            onHome={goHome}
            onSelectPlan={selectPlan}
            onContinue={continuePlan}
          />
        );
      case "explore":
        return (
          <ExploreScreen
            state={state}
            t={t}
            onLang={setLang}
            onHome={goHome}
            onSearch={setSearch}
            onSelectMapShop={setMapShop}
            onCloseMapShop={closeMapShop}
            onBook={bookShop}
          />
        );
      case "detail":
        return (
          <DetailScreen
            shop={currentShop}
            state={state}
            t={t}
            onBack={goHome}
            onBooking={() => setScreen("booking")}
            onQuickView={setQuickShop}
            onShop={selectShop}
            onSearch={setSearch}
          />
        );
      case "booking":
        return (
          <BookingScreen
            state={state}
            shop={currentShop}
            t={t}
            onLang={setLang}
            onBack={() => setScreen("detail")}
            onDate={setDate}
            onTime={setTime}
            onService={toggleService}
            onVehicle={setVehicle}
            onConfirm={confirmBooking}
          />
        );
      case "confirmation":
        return (
          <ConfirmationScreen
            state={state}
            shop={currentShop}
            t={t}
            onRewards={() => setScreen("rewards")}
            onHome={goHome}
          />
        );
      case "bookings":
        return <BookingsScreen state={state} shop={currentShop} t={t} onLang={setLang} onHome={goHome} />;
      case "rewards":
        return (
          <RewardsScreen
            state={state}
            t={t}
            onLang={setLang}
            onHome={goHome}
            onVouchers={() => setScreen("vouchers")}
          />
        );
      case "vouchers":
        return <VouchersScreen state={state} t={t} onLang={setLang} onHome={goHome} />;
      case "account":
        return (
          <AccountScreen
            state={state}
            t={t}
            onLang={setLang}
            onHome={goHome}
            onPlans={() => setScreen("plans")}
            onVouchers={() => setScreen("vouchers")}
            onReset={resetDemo}
          />
        );
      case "home":
      default:
        return (
          <HomeScreen
            state={state}
            t={t}
            onLang={setLang}
            onHome={goHome}
            onSearch={setSearch}
            onShop={selectShop}
            onQuickView={setQuickShop}
            onExplore={goExplore}
            onService={exploreService}
            onBook={startBooking}
            onBookings={() => setScreen("bookings")}
          />
        );
    }
  })();

  return (
    <DeviceShell
      activeNav={bottomNavByScreen[state.screen]}
      topActive={topNavByScreen[state.screen]}
      onScreen={setScreen}
      t={t}
      lang={state.lang}
      onLang={setLang}
    >
      {screen}
      {quickShop ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 p-4 lg:items-center">
          <div className="w-full max-w-[370px] rounded-[22px] bg-white p-3 shadow-device">
            <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-neutral-200" />
            <ShopCard shop={quickShop} t={t} onSelect={selectShop} onQuickView={setQuickShop} />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={closeQuickShop}>{t("close")}</Button>
              <Button onClick={() => selectShop(quickShop.id)}>{t("bookNow")}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </DeviceShell>
  );
}
