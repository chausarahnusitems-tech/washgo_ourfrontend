import { useCallback, useEffect, useMemo, useState } from "react";
import { copy } from "./data/copy.js";
import { shops } from "./data/catalog.js";
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
import { DetailScreen } from "./screens/DetailScreen.jsx";
import { BookingScreen } from "./screens/BookingScreen.jsx";
import { ConfirmationScreen } from "./screens/ConfirmationScreen.jsx";
import { BookingsScreen } from "./screens/BookingsScreen.jsx";
import { RewardsScreen } from "./screens/RewardsScreen.jsx";
import { VouchersScreen } from "./screens/VouchersScreen.jsx";
import { AccountScreen } from "./screens/AccountScreen.jsx";

const navByScreen = {
  home: "home",
  bookings: "bookings",
  rewards: "rewards",
  vouchers: "rewards",
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
    setState((prev) => ({ ...prev, screen, quickShop: null }));
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

  const setSearch = useCallback((search) => {
    setState((prev) => ({ ...prev, search }));
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
      case "detail":
        return (
          <DetailScreen
            shop={currentShop}
            t={t}
            onBack={goHome}
            onBooking={() => setScreen("booking")}
            onQuickView={setQuickShop}
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
          />
        );
    }
  })();

  return (
    <DeviceShell activeNav={navByScreen[state.screen]} onScreen={setScreen} t={t}>
      {screen}
      {quickShop ? (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/35 p-4">
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
