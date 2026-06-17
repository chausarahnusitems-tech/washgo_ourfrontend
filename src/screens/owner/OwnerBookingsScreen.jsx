"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Clock, MessageCircle, Store } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { createClient } from "../../lib/supabase/client.js";
import { fetchOwnerShops, fetchOwnerBookings } from "../../lib/data/api.js";
import { getBookingStatus } from "../../lib/booking.js";
import { parseIsoDate } from "../../lib/calendar.js";
import { formatVnd } from "./format.js";

// Parse a slot label ("9.00AM", "12.30PM") into minutes-of-day so timeslots sort
// chronologically rather than lexically. Unparseable labels sort last.
function slotToMinutes(label) {
  const m = String(label ?? "").match(/(\d{1,2})[.:](\d{2})\s*(AM|PM)?/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const mer = m[3]?.toUpperCase();
  if (mer === "PM" && h !== 12) h += 12;
  if (mer === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

// Owner's upcoming bookings across all their shops, grouped by date and sorted by
// date then timeslot. Each booking links to its per-booking chat with the
// customer. RLS scopes bookings to the owner's shops.
export function OwnerBookingsScreen() {
  const { auth, t, lang } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const uid = auth.user?.id ?? null;
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!supabase || !uid) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const shops = await fetchOwnerShops(supabase, uid);
        const rows = await fetchOwnerBookings(
          supabase,
          shops.map((s) => s.id)
        );
        // Time-aware "upcoming": an elapsed booking that was never flipped to
        // completed shouldn't linger here (matches the customer-side helper).
        if (active) {
          setBookings(
            rows.filter((b) => getBookingStatus({ status: b.status, dateId: b.date, time: b.time }) === "upcoming")
          );
        }
      } catch (err) {
        console.error("[washgo] load owner bookings failed", err);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase, uid]);

  // Group by date (asc), bookings within a date sorted by timeslot (asc).
  const groups = useMemo(() => {
    const byDate = new Map();
    for (const b of bookings) {
      if (!byDate.has(b.date)) byDate.set(b.date, []);
      byDate.get(b.date).push(b);
    }
    return [...byDate.entries()]
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, list]) => [date, list.sort((x, y) => slotToMinutes(x.time) - slotToMinutes(y.time))]);
  }, [bookings]);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <header>
        <h1 className="font-display text-2xl font-black">{t("upcomingBookings")}</h1>
        <p className="mt-1 text-sm text-neutral-500">{t("upcomingBookingsSub")}</p>
      </header>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">{t("loading")}</p>
      ) : error ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-12 text-center">
          <CalendarClock className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">{t("loadError")}</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-12 text-center">
          <CalendarClock className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">{t("noUpcoming")}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map(([date, list]) => (
            <section key={date}>
              <h2 className="sticky top-0 z-10 bg-white/90 py-1 text-xs font-black uppercase tracking-wide text-neutral-500 backdrop-blur">
                {(parseIsoDate(date) ?? new Date(date)).toLocaleDateString(locale, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })}
              </h2>
              <ul className="mt-2 grid gap-2">
                {list.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-black/5 bg-white p-4"
                  >
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink">
                      <Clock className="h-4 w-4 text-wash-500" aria-hidden="true" />
                      {b.time}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-neutral-600">
                      <Store className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                      {b.shop}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-neutral-500">
                      {b.services.length ? b.services.map((id) => t(id)).join(", ") : t("noServices")}
                    </span>
                    <span className="text-sm font-bold text-ink">{formatVnd(b.total)}</span>
                    {b.conversationId && (
                      <Link
                        href={`/owner/messages?c=${b.conversationId}`}
                        className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-50"
                      >
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("openChat")}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
