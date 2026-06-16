import { dates } from "../data/catalog.js";
import { getCatalog } from "./catalog-store.js";
import { formatIsoLabel } from "./calendar.js";

// Navigation state (screen, selectedShop, mapShop, quickShop, search, prevScreen)
// now lives in the URL — only domain/session state remains here.
export const initialState = {
  lang: "en",
  // Membership tier. 'basic' is the non-member default; joining the paid
  // membership upgrades to 'premium' (10% checkout discount + perks).
  selectedPlan: "basic",
  // Cash wallet balance in VND. This is the *spendable* balance: the two seeded
  // upcoming bookings below (90.000 + 144.000 = 234.000) are treated as already
  // paid from a 500.000 top-up, leaving 266.000 — so cancelling them refunds
  // back toward 500.000 without minting money the user never spent.
  funds: 266000,
  stamps: 4,
  voucher: false,
  // Set true when the user taps "Use voucher": the next confirmed booking is
  // free (and resets the loyalty card). See confirmBooking / redeemVoucher.
  pendingVoucher: false,
  // Shop ids the user has favourited (Heart toggle). Persisted via localStorage.
  favorites: [],
  // The most recently confirmed booking (used by the confirmation screen) plus
  // the full history of booked slots shown on the Bookings page. Each booking
  // carries a `status` (upcoming | completed | cancelled); upcoming ones are
  // editable/cancellable, the rest live under History.
  booking: null,
  bookings: [
    {
      id: "bk-seed-1",
      shopId: "sparkle",
      shop: "Sparkle Auto Wash",
      dateId: "today",
      date: "Today 11 Jun",
      time: "12.00PM",
      services: ["exterior", "interior"],
      total: 90000,
      plan: "premium",
      status: "upcoming"
    },
    {
      id: "bk-seed-2",
      shopId: "lotus",
      shop: "Lotus Detail Studio",
      dateId: "sat",
      date: "Sat 13 Jun",
      time: "2.00PM",
      services: ["detailing", "wax"],
      total: 144000,
      plan: "premium",
      status: "upcoming"
    },
    {
      id: "bk-seed-3",
      shopId: "saigon",
      shop: "Saigon Shine Hub",
      dateId: null,
      date: "Wed 3 Jun",
      time: "10.00AM",
      services: ["exterior"],
      total: 45000,
      plan: "premium",
      status: "completed"
    },
    {
      id: "bk-seed-4",
      shopId: "sparkle",
      shop: "Sparkle Auto Wash",
      dateId: null,
      date: "Mon 1 Jun",
      time: "4.00PM",
      services: ["detailing"],
      total: 90000,
      plan: "premium",
      status: "cancelled"
    }
  ],
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
  const { plans } = getCatalog();
  return plans.find((plan) => plan.id === selectedPlan) ?? plans[1];
}

export function getCurrentShop(selectedShop) {
  const { shops } = getCatalog();
  return shops.find((shop) => shop.id === selectedShop) ?? shops[0];
}

// Strict lookup that returns null for an unknown id (unlike getCurrentShop,
// which falls back to shops[0]). Used to detect typo'd / stale deep links.
export function getShopById(id) {
  const { shops } = getCatalog();
  return shops.find((shop) => shop.id === id) ?? null;
}

export function getSelectedServices(selectedServiceIds) {
  const { services } = getCatalog();
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
  // Legacy quick-pick ids (today/tomorrow/sat/sun) keep their translated label.
  const legacy = dates.find((item) => item.id === selectedDate);
  if (legacy) return `${t(legacy.label)} ${legacy.number} ${legacy.sub}`;
  // Dynamic-calendar ids are ISO dates (e.g. "2026-06-20").
  const isoLabel = formatIsoLabel(selectedDate);
  if (isoLabel) return isoLabel;
  const fallback = dates[0];
  return `${t(fallback.label)} ${fallback.number} ${fallback.sub}`;
}

export function getVisibleShops(search, serviceId = null) {
  const { shops } = getCatalog();
  const needle = (search ?? "").trim().toLowerCase();

  return shops.filter((shop) => {
    if (serviceId && !shop.services.includes(serviceId)) return false;
    if (!needle) return true;
    return `${shop.name} ${shop.district} ${shop.address} ${shop.services.join(" ")}`
      .toLowerCase()
      .includes(needle);
  });
}

export function toggleItem(items, item) {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
}

// Generate "HH:MM" booking slot labels from a shop's structured hours, stepping
// by slotMinutes from open (inclusive) to close (the last slot starts at most
// one step before close). Returns null when hours aren't set, so callers fall
// back to the legacy fixed slot list (src/data/catalog.js `times`).
export function generateSlots(openTime, closeTime, slotMinutes = 60) {
  if (!openTime || !closeTime) return null;
  const toMin = (value) => {
    const [h, m] = String(value).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const start = toMin(openTime);
  const end = toMin(closeTime);
  const step = Math.max(15, slotMinutes || 60);
  if (!(end > start)) return null;
  const out = [];
  for (let m = start; m + step <= end; m += step) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out.length ? out : null;
}

// Bookings without an explicit status are treated as upcoming (covers older
// persisted state that predates the status field).
export function getBookingStatus(booking) {
  return booking?.status ?? "upcoming";
}

export function getUpcomingBookings(bookings) {
  return (bookings ?? []).filter((booking) => getBookingStatus(booking) === "upcoming");
}

export function getHistoryBookings(bookings) {
  return (bookings ?? []).filter((booking) => getBookingStatus(booking) !== "upcoming");
}

export function getBookingById(bookings, id) {
  return (bookings ?? []).find((booking) => booking.id === id) ?? null;
}

// The user's available vouchers. The 10%-off detailing voucher is always
// present; the free-wash voucher appears once the loyalty card is full
// (`voucher`). Centralised so the list and every "N vouchers" count stay in
// sync (callers used to hardcode `voucher ? 2 : 1`).
export function getVouchers(voucher, t) {
  const vouchers = [
    {
      id: "detailing10",
      title: t("discountVoucherTitle"),
      copy: t("discountVoucherCopy"),
      code: "DETAIL10",
      expires: "20 Jul 2026",
      tone: "red"
    }
  ];

  if (voucher) {
    vouchers.unshift({
      id: "freewash",
      title: t("voucherTitle"),
      copy: t("voucherCopy"),
      code: "WASHGO-FREE-01",
      expires: "31 Aug 2026",
      tone: "green"
    });
  }

  return vouchers;
}
