// Opening-hours model shared by the explore detail modal (ShopDetailCard) and the
// list cards (ShopCard), so both surface the current open/closed state, the nearest
// transition ("Closes 22:00" / "Opens Mon 08:00") and the weekly breakdown in the
// same way. Hours come from (in priority order) the per-weekday `weeklyHours` jsonb,
// the single `openTime`/`closeTime` default, then the legacy free-text `hours`
// string that seed/imported shops carry.

import { WEEKDAYS_SHORT } from "./calendar.js";

// Full weekday names for the expanded breakdown (0=Sun..6=Sat, matching
// Date.getDay() and the weekly_hours keys). The booking calendar already shows
// English weekday labels regardless of locale, so we follow that here.
export const WEEKDAYS_LONG = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];
// Monday-first display order for the breakdown.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// "8:00" / "08:00" / "08:00:00" -> minutes since midnight, or null when unparseable.
function parseHm(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

// minutes since midnight -> "HH:MM".
function fmtHm(total) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Parse the free-text `hours` display string ("07:00 - 22:00", "24 Hrs").
function parseHoursString(hours) {
  const s = String(hours ?? "").trim();
  if (!s) return null;
  if (/24\s*(h|hr|hrs|hours|giờ)\b|24\s*\/\s*7/i.test(s)) return { open: 0, close: 1440 };
  const m = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return null;
  const open = Number(m[1]) * 60 + Number(m[2]);
  const close = Number(m[3]) * 60 + Number(m[4]);
  return close > open ? { open, close } : null;
}

// A full-day (00:00–24:00) window — surfaced as "Open 24 hours" rather than a
// concrete closing time.
function isAllDay(day) {
  return Boolean(day) && !day.closed && day.open <= 0 && day.close >= 1440;
}

// Resolve a single weekday's hours, mirroring booking.js `getDayHours`. Returns
// { closed:true } | { open, close } (minutes) | null when nothing is known.
function resolveDayHours(shop, dayIndex) {
  const entry = shop.weeklyHours?.[String(dayIndex)];
  if (entry) {
    if (entry.closed) return { closed: true };
    const open = parseHm(entry.open);
    const close = parseHm(entry.close);
    if (open != null && close != null && close > open) return { open, close };
  }
  const open = parseHm(shop.openTime);
  const close = parseHm(shop.closeTime);
  if (open != null && close != null && close > open) return { open, close };
  return parseHoursString(shop.hours);
}

// The next weekday (starting today) the shop opens, after `afterMin` on the current
// day. Returns { idx, min, offset } or null when never open.
function findNextOpen(days, fromIdx, afterMin) {
  for (let i = 0; i < 8; i += 1) {
    const idx = (fromIdx + i) % 7;
    const day = days[idx];
    if (!day || day.closed) continue;
    const openMin = isAllDay(day) ? 0 : day.open;
    if (i === 0) {
      if (openMin > afterMin) return { idx, min: openMin, offset: 0 };
      continue; // today already opened (and closed) — look ahead
    }
    return { idx, min: openMin, offset: i };
  }
  return null;
}

// Derive the opening-hours model for `shop` at instant `now` (a Date). `t` localizes
// the labels. `known:false` means no parseable hours at all, so callers fall back to
// the raw `hours` string + the shop's `open` flag.
export function computeHoursModel(shop, now, t) {
  const days = [];
  let known = false;
  for (let i = 0; i < 7; i += 1) {
    const day = resolveDayHours(shop, i);
    days[i] = day;
    if (day) known = true;
  }
  if (!known) return { known: false };

  const todayIdx = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = days[todayIdx];

  let isOpen = false;
  let detail = null;
  if (isAllDay(today)) {
    isOpen = true;
    detail = t("open24h");
  } else if (today && !today.closed && nowMin >= today.open && nowMin < today.close) {
    isOpen = true;
    detail = `${t("closesAt")} ${fmtHm(today.close)}`;
  } else {
    const next = findNextOpen(days, todayIdx, nowMin);
    if (next) {
      detail =
        next.offset === 0
          ? `${t("opensAt")} ${fmtHm(next.min)}`
          : `${t("opensAt")} ${WEEKDAYS_SHORT[next.idx]} ${fmtHm(next.min)}`;
    }
  }

  const week = WEEK_ORDER.map((idx) => {
    const day = days[idx];
    return {
      idx,
      label: WEEKDAYS_LONG[idx],
      isToday: idx === todayIdx,
      closed: !day || day.closed,
      text: !day
        ? "—"
        : day.closed
          ? t("closed")
          : isAllDay(day)
            ? t("open24h")
            : `${fmtHm(day.open)} – ${fmtHm(day.close)}`
    };
  });

  return { known: true, isOpen, detail, week };
}

// Lightweight "is the shop open at `now`?" check for filtering. Returns true/false
// from the schedule, or null when today's hours can't be parsed (callers fall back
// to the stored `open` flag). Mirrors the open-state logic in computeHoursModel.
export function isShopOpenNow(shop, now) {
  const today = resolveDayHours(shop, now.getDay());
  if (today === null) return null;
  if (today.closed) return false;
  if (isAllDay(today)) return true;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= today.open && nowMin < today.close;
}
