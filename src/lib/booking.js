import { dates } from "../data/catalog.js";
import { getCatalog } from "./catalog-store.js";
import { formatIsoLabel, parseIsoDate, resolveBookingIso } from "./calendar.js";

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
  // Applied promo/referral coupon at checkout ({ code, percent, amountOff }) or null.
  promo: null,
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

// Discount from an applied promo/referral coupon ({ percent, amountOff }), priced
// the same way the server does it: a fixed amount wins over a percent, percents
// round to the nearest 1,000₫, and the discount never exceeds the remaining
// subtotal (after any membership discount already taken).
export function getCouponDiscount(coupon, subtotal, alreadyDiscounted = 0) {
  if (!coupon || subtotal <= 0) return 0;
  let value = 0;
  if (coupon.amountOff > 0) value = coupon.amountOff;
  else if (coupon.percent > 0) value = Math.round((subtotal * coupon.percent) / 100 / 1000) * 1000;
  return Math.max(0, Math.min(value, subtotal - alreadyDiscounted));
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

// Fold accents/diacritics so search is forgiving: "wurth" matches "Würth",
// "an phu" matches "An Phú", "thu duc" matches "Thủ Đức". Strips combining marks
// (NFD) and maps Vietnamese đ/Đ (which don't decompose) to d.
export function foldAccents(value) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

// Bounded Levenshtein: true when `a` and `b` are within `max` edits. Early-exits
// on a length gap so it stays cheap for the per-keystroke search.
function withinEdits(a, b, max) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > max) return false;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    let best = curr[0];
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < best) best = curr[j];
    }
    if (best > max) return false; // whole row already over budget
    [prev, curr] = [curr, prev];
  }
  return prev[n] <= max;
}

function wordMatchesToken(word, token) {
  if (word.includes(token) || token.includes(word)) return true;
  return withinEdits(word, token, token.length <= 4 ? 1 : 2);
}

// Elastic relevance score for a shop against a folded query. Matches across
// name + district + address + services, tolerant of small typos. Returns a higher
// number for stronger matches, or -1 for no match. Empty query scores 0.
export function shopMatchScore(shop, foldedNeedle) {
  if (!foldedNeedle) return 0;
  const nameF = foldAccents(shop.name);
  const hayFull = foldAccents(
    `${shop.name} ${shop.district} ${shop.address} ${(shop.services ?? []).join(" ")}`
  );
  if (hayFull.includes(foldedNeedle)) {
    if (nameF.includes(foldedNeedle)) return 200 - nameF.indexOf(foldedNeedle);
    return 100;
  }
  // Token-AND match with per-token typo tolerance ("thoa dien" -> "thao dien").
  const tokens = foldedNeedle.split(/\s+/).filter(Boolean);
  const words = hayFull.split(/\s+/).filter(Boolean);
  let matched = 0;
  for (const token of tokens) {
    if (words.some((word) => wordMatchesToken(word, token))) matched += 1;
    else return -1; // every query token must land somewhere
  }
  return 30 + matched;
}

// The list of shops for the sidebar/results, filtered by the service chip and the
// fuzzy text query, ranked best-match first. (The MAP keeps all pins — callers
// pass the unfiltered set there and use getBestShopMatch for centering.)
export function getVisibleShops(search, serviceId = null) {
  const { shops } = getCatalog();
  return rankShops(shops, search, serviceId);
}

export function rankShops(shops, search, serviceId = null) {
  const needle = foldAccents((search ?? "").trim());
  const scoped = serviceId ? shops.filter((s) => (s.services ?? []).includes(serviceId)) : shops;
  if (!needle) return scoped;
  return scoped
    .map((shop) => ({ shop, score: shopMatchScore(shop, needle) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.shop);
}

// Default browse order for the map list: partnered (bookable) shops before
// directory/info-only listings, and within each group the nearest first. Shops
// with no computed distance (missing lat/lng) sort last. Pure — returns a new
// array, leaving the input untouched. `distanceKm` is added per-shop by
// AppContext.liveCatalog (haversine from the user's live location).
export function sortByPartnerThenDistance(shops) {
  return [...shops].sort((a, b) => {
    const ap = a.listingType === "directory" ? 1 : 0;
    const bp = b.listingType === "directory" ? 1 : 0;
    if (ap !== bp) return ap - bp;
    return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
  });
}

// The single best-matching shop id for a query (used to re-center/highlight the
// map without hiding the other pins). Null when the query is empty or unmatched.
export function getBestShopMatch(shops, search, serviceId = null) {
  const needle = foldAccents((search ?? "").trim());
  if (!needle) return null;
  let best = null;
  let bestScore = 0;
  for (const shop of shops) {
    if (serviceId && !(shop.services ?? []).includes(serviceId)) continue;
    const score = shopMatchScore(shop, needle);
    if (score > bestScore) {
      bestScore = score;
      best = shop;
    }
  }
  return best?.id ?? null;
}

export function toggleItem(items, item) {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
}

// Day-of-week labels (0=Sun..6=Sat), matching JS Date.getDay() and the
// weekly_hours jsonb keys. Used by the owner editor and the booking calendar.
export const WEEKDAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"];
export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The effective opening hours for a shop on a given date. Prefers the per-weekday
// `weeklyHours` entry, falls back to the single open/close default. Returns null
// when the shop is closed that weekday (so the caller offers no slots).
export function getDayHours(shop, dateId) {
  const fallback = { open: shop?.openTime ?? null, close: shop?.closeTime ?? null };
  const day = parseIsoDate(resolveBookingIso(dateId));
  if (!day || !shop?.weeklyHours) return fallback;
  const entry = shop.weeklyHours[String(day.getDay())];
  if (!entry) return fallback;
  if (entry.closed) return null; // closed this weekday
  return { open: entry.open || fallback.open, close: entry.close || fallback.close };
}

// True when the shop's weekly schedule marks the given date's weekday as closed.
export function isWeeklyClosed(shop, dateId) {
  if (!shop?.weeklyHours) return false;
  const day = parseIsoDate(resolveBookingIso(dateId));
  if (!day) return false;
  return Boolean(shop.weeklyHours[String(day.getDay())]?.closed);
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

// Parse a stored slot label into 24h {hours, minutes}. Handles both the legacy
// 12h dotted format ("10.00AM", "12.30PM", "2.00PM") and the structured 24h
// format from generateSlots ("10:00", "14:30"). Returns null when unparseable.
function parseSlotTime(time) {
  if (typeof time !== "string") return null;
  const match = /^\s*(\d{1,2})[:.](\d{2})\s*([AaPp][Mm])?\s*$/.exec(time);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "AM") {
    if (hours === 12) hours = 0;
  } else if (meridiem === "PM") {
    if (hours !== 12) hours += 12;
  }
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

// The absolute local Date a booking is scheduled for, derived from its dateId
// (ISO date, or a legacy quick-pick id resolved against the real calendar) plus
// its slot time. Returns null when the date can't be resolved. A booking with no
// parseable time falls back to end-of-day so a same-day slot isn't flagged
// elapsed before the day is actually over.
export function getBookingDateTime(booking) {
  if (!booking) return null;
  const day = parseIsoDate(resolveBookingIso(booking.dateId));
  if (!day) return null;
  const slot = parseSlotTime(booking.time);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    slot ? slot.hours : 23,
    slot ? slot.minutes : 59
  );
}

// True once a booking's scheduled slot is in the past.
export function isBookingElapsed(booking) {
  const when = getBookingDateTime(booking);
  return Boolean(when && when.getTime() < Date.now());
}

// Effective status. Cancelled/completed are terminal and kept as recorded; an
// "upcoming" booking whose slot has already passed is treated as completed so it
// moves out of the upcoming list and into history automatically (no background
// job needed). Bookings without an explicit status default to upcoming (covers
// older persisted state that predates the status field).
export function getBookingStatus(booking) {
  const stored = booking?.status ?? "upcoming";
  if (stored !== "upcoming") return stored;
  return isBookingElapsed(booking) ? "completed" : "upcoming";
}

export function getUpcomingBookings(bookings) {
  return (bookings ?? []).filter((booking) => getBookingStatus(booking) === "upcoming");
}

export function getHistoryBookings(bookings) {
  return (bookings ?? []).filter((booking) => getBookingStatus(booking) !== "upcoming");
}

// The most recent past booking, for the home "Previous Booking" card. Real
// completed washes rank above cancelled ones; ties break on the most recent
// scheduled datetime. Returns null when there's no history yet.
export function getPreviousBooking(bookings) {
  const ranked = getHistoryBookings(bookings)
    .map((booking) => ({
      booking,
      when: getBookingDateTime(booking)?.getTime() ?? 0,
      done: getBookingStatus(booking) === "completed" ? 1 : 0
    }))
    .sort((a, b) => b.done - a.done || b.when - a.when);
  return ranked[0]?.booking ?? null;
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
