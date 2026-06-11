import { dates, plans, services, shops } from "../data/catalog.js";

// Navigation state (screen, selectedShop, mapShop, quickShop, search, prevScreen)
// now lives in the URL — only domain/session state remains here.
export const initialState = {
  lang: "en",
  selectedPlan: "premium",
  // No seeded balance: personal data (tokens, stamps, vouchers) only exists for
  // a signed-in user, loaded from their Supabase profile. Signed-out is empty.
  tokens: 0,
  stamps: 0,
  voucher: false,
  booking: null,
  selectedServices: ["exterior", "interior"],
  selectedDate: "today",
  selectedTime: "12.00PM",
  vehicle: {
    model: "BMW 1234",
    plate: "51G-248.19",
    notes: ""
  }
};

// The default shop used when a booking action isn't anchored to a specific
// shop route (e.g. the desktop dashboard "Book Wash" quick action).
export const DEFAULT_SHOP_ID = "sparkle";

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
