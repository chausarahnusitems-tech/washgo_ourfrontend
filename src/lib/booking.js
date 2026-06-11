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
      date: "Today 26 May",
      time: "12.00PM",
      services: ["exterior", "interior"],
      total: 90000,
      status: "upcoming"
    },
    {
      id: "bk-seed-2",
      shopId: "lotus",
      shop: "Lotus Detail Studio",
      dateId: "sat",
      date: "Sat 28 May",
      time: "2.00PM",
      services: ["detailing", "wax"],
      total: 144000,
      status: "upcoming"
    },
    {
      id: "bk-seed-3",
      shopId: "saigon",
      shop: "Saigon Shine Hub",
      dateId: null,
      date: "Wed 7 May",
      time: "10.00AM",
      services: ["exterior"],
      total: 45000,
      status: "completed"
    },
    {
      id: "bk-seed-4",
      shopId: "sparkle",
      shop: "Sparkle Auto Wash",
      dateId: null,
      date: "Mon 5 May",
      time: "4.00PM",
      services: ["detailing"],
      total: 90000,
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
