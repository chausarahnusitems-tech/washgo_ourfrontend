// Map database rows back into the exact object shapes the UI already consumes,
// so the screens and cards don't need to know whether the catalog came from the
// DB or the hardcoded fallback. The DB stores normalised numbers
// (starting_price, wait_minutes, reviews_count, rating) while the UI expects
// pre-formatted display strings (e.g. "12 min", "2.1k", "4.9") plus a computed
// "distance" that doesn't exist in the DB at all.
import { userLocation } from "../../data/catalog.js";

// Haversine great-circle distance in km between two {lat,lng} points.
export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
    return null;
  }
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 2100 -> "2.1k", 870 -> "870" (matches the catalog's hand-written strings).
export function formatReviews(count) {
  const n = Number(count) || 0;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

// 1.0367 -> "1.0 km"
export function formatDistanceKm(km) {
  if (km == null || !Number.isFinite(km)) return "";
  return `${km.toFixed(1)} km`;
}

function formatVndPlain(amount) {
  return `${Math.round(Number(amount) || 0)
    .toLocaleString("en-US")
    .replace(/,/g, ".")}₫`;
}

// Gallery photos for a shop: cover first, then by sort order. Falls back to the
// single denormalised image_url so shops without gallery rows still show a photo.
function adaptShopPhotos(row) {
  const photos = (row.shop_photos ?? [])
    .slice()
    .sort((a, b) => (b.is_cover === a.is_cover ? (a.sort_order ?? 0) - (b.sort_order ?? 0) : b.is_cover ? 1 : -1))
    .map((p) => p.url)
    .filter(Boolean);
  if (row.image_url && !photos.includes(row.image_url)) photos.unshift(row.image_url);
  return photos;
}

// DB shop row (+ joined service ids) -> the catalog's shop shape.
export function adaptShop(row, origin = userLocation) {
  const km = haversineKm(origin, { lat: row.lat, lng: row.lng });
  const imageUrls = adaptShopPhotos(row);
  // The promo video only counts as live while the paid feature hasn't lapsed.
  const videoActive = Boolean(
    row.promo_video_url &&
      row.video_feature_until &&
      new Date(row.video_feature_until) >= new Date(new Date().toDateString())
  );
  return {
    id: row.id,
    ownerId: row.owner_id ?? null,
    // Customer-facing cover + gallery (owner-uploaded). `imageUrl` is the cover;
    // `imageUrls` is the full gallery (cover first). Cards fall back to the static
    // hero when these are empty.
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    // Paid promo video (only surfaced while the feature is active).
    promoVideoUrl: videoActive ? row.promo_video_url : null,
    // 'partner' = a real bookable Washgo shop; 'directory' = an imported, info-only
    // listing (business hasn't partnered yet — shown on the map but not bookable).
    listingType: row.listing_type ?? "partner",
    phone: row.phone ?? "",
    notes: row.notes ?? "",
    claimedBy: row.claimed_by ?? null,
    name: row.name,
    district: row.district ?? "",
    address: row.address ?? "",
    distance: formatDistanceKm(km),
    distanceKm: km,
    rating: row.rating != null ? Number(row.rating).toFixed(1) : "0.0",
    reviews: formatReviews(row.reviews_count),
    starting: row.starting_price ?? 0,
    wait: row.wait_minutes != null ? `${row.wait_minutes} min` : "",
    services: row.services ?? [],
    // Per-shop custom (owner-defined) services — bookable alongside the catalogue
    // ones. Keyed by uuid id; name is shown directly (not via i18n).
    customServices: (row.shop_custom_services ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      price: c.price ?? 0,
      imageUrl: c.image_url ?? null,
      isOffer: Boolean(c.is_offer)
    })),
    imagePosition: row.image_position ?? "object-center",
    open: row.is_open ?? true,
    // null (not "") so the cards' `shop.hours ?? t("hours")` fallback fires for a
    // shop with no hours, instead of rendering a blank segment.
    hours: row.hours || null,
    promo: row.promo ?? false,
    lat: row.lat,
    lng: row.lng,
    // Structured scheduling (Phase 5) — used to generate booking time slots.
    openTime: row.open_time ?? null,
    closeTime: row.close_time ?? null,
    slotMinutes: row.slot_minutes ?? 60,
    maxCarsPerSlot: row.max_cars_per_slot ?? 1,
    // Per-weekday opening hours (jsonb keyed by day-of-week 0=Sun..6=Sat), or null
    // to use the single open/close default.
    weeklyHours: row.weekly_hours ?? null
  };
}

// DB service row -> catalog service shape. The display name is resolved via i18n
// from the id (t(service.id)), so only id/price/icon are needed.
export function adaptService(row) {
  return { id: row.id, price: row.price ?? 0, icon: row.icon ?? "Car" };
}

// DB plan row (price stored as an int) -> catalog plan shape (price is a
// pre-formatted "199.000₫" string in the UI).
export function adaptPlan(row) {
  return { id: row.id, price: formatVndPlain(row.price), badge: Boolean(row.badge) };
}

// DB booking row (+ joined service ids) -> the UI booking shape. dateId is null
// for DB rows (only an ISO scheduled_date is stored); getSelectedDateLabel
// handles an ISO id, and the stored `date` label keeps history readable.
export function adaptBooking(row, dateLabel) {
  return {
    id: row.id,
    shopId: row.shop_id,
    shop: row.shop_name ?? row.shop_id,
    dateId: row.scheduled_date,
    date: dateLabel ?? row.scheduled_date,
    time: row.slot_time,
    services: row.services ?? [],
    total: row.total ?? 0,
    plan: row.plan_id,
    freeWash: Boolean(row.free_wash),
    earnedStamp: Boolean(row.earned_stamp),
    status: row.status ?? "upcoming"
  };
}
