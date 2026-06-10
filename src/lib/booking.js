import { dates, plans, services, shops } from "../data/catalog.js";

export const initialState = {
  lang: "en",
  screen: "home",
  prevScreen: null,
  selectedPlan: "premium",
  // Seed the premium plan's balance so the marketplace is usable from the Home
  // landing. (Plan selection is now optional via Account → Upgrade Plan, so we
  // can no longer rely on that flow to grant the starting tokens.)
  tokens: 100,
  stamps: 4,
  voucher: false,
  booking: null,
  selectedShop: "sparkle",
  selectedServices: ["exterior", "interior"],
  selectedDate: "today",
  selectedTime: "12.00PM",
  search: "",
  quickShop: null,
  mapShop: null,
  vehicle: {
    model: "BMW 1234",
    plate: "51G-248.19",
    notes: ""
  }
};

export function getCurrentPlan(selectedPlan) {
  return plans.find((plan) => plan.id === selectedPlan) ?? plans[1];
}

export function getCurrentShop(selectedShop) {
  return shops.find((shop) => shop.id === selectedShop) ?? shops[0];
}

export function getSelectedServices(selectedServiceIds) {
  const selected = new Set(selectedServiceIds);
  return services.filter((service) => selected.has(service.id));
}

export function getSubtotal(selectedServiceIds) {
  return getSelectedServices(selectedServiceIds).reduce((sum, service) => sum + service.token, 0);
}

export function getDiscount(selectedPlan, selectedServiceIds) {
  return selectedPlan === "premium" && getSubtotal(selectedServiceIds) > 0 ? 1 : 0;
}

export function getTotal(selectedPlan, selectedServiceIds) {
  return Math.max(0, getSubtotal(selectedServiceIds) - getDiscount(selectedPlan, selectedServiceIds));
}

export function getSelectedDateLabel(selectedDate, t) {
  const date = dates.find((item) => item.id === selectedDate) ?? dates[0];
  return `${t(date.label)} ${date.number} ${date.sub}`;
}

export function getVisibleShops(search) {
  const needle = search.trim().toLowerCase();
  if (!needle) return shops;

  return shops.filter((shop) =>
    `${shop.name} ${shop.district} ${shop.address} ${shop.services.join(" ")}`
      .toLowerCase()
      .includes(needle)
  );
}

export function toggleItem(items, item) {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
}
