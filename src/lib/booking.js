import { dates, plans, services, shops } from "../data/catalog.js";

// Navigation state (screen, selectedShop, mapShop, quickShop, search, prevScreen)
// now lives in the URL — only domain/session state remains here.
export const initialState = {
  lang: "en",
  // Membership tier. Unlocks perks + a checkout discount; it no longer funds the
  // wallet (the cash wallet is topped up separately).
  selectedPlan: "premium",
  // Cash wallet balance in VND. Seeded so the marketplace is usable from the
  // Home landing; the user tops this up via Account → Top Up Funds.
  funds: 500000,
  stamps: 4,
  voucher: false,
  // The most recently confirmed booking (used by the confirmation screen) plus
  // the full history of booked slots shown on the Bookings page.
  booking: null,
  bookings: [],
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
  return getSelectedServices(selectedServiceIds).reduce((sum, service) => sum + service.price, 0);
}

// Premium members get 10% off, rounded to the nearest 1,000 VND.
export function getDiscount(selectedPlan, selectedServiceIds) {
  const subtotal = getSubtotal(selectedServiceIds);
  if (selectedPlan !== "premium" || subtotal <= 0) return 0;
  return Math.round((subtotal * 0.1) / 1000) * 1000;
}

export function getTotal(selectedPlan, selectedServiceIds) {
  return Math.max(0, getSubtotal(selectedServiceIds) - getDiscount(selectedPlan, selectedServiceIds));
}

// Format a VND amount with dot thousands separators and the ₫ suffix, matching
// local convention (e.g. 50000 -> "50.000₫").
export function formatVnd(amount) {
  return `${Math.round(amount).toLocaleString("en-US").replace(/,/g, ".")}₫`;
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
