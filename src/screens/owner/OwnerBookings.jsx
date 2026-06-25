"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { createClient } from "../../lib/supabase/client.js";
import { fetchOwnerBookings } from "../../lib/data/api.js";
import { cx } from "../../lib/cx.js";
import { formatVnd } from "./format.js";

const STATUS_STYLES = {
  upcoming: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-neutral-100 text-neutral-500"
};

// Read-only list of bookings made at this shop. RLS grants owners select (not
// write) and does not expose the customer's identity, so we show the schedule,
// services and status only.
export function OwnerBookings({ shopId }) {
  const { t } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchOwnerBookings(supabase, [shopId])
      .then((rows) => {
        if (active) setBookings(rows);
      })
      .catch((err) => console.error("[washgo] fetch owner bookings failed", err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [supabase, shopId]);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  if (bookings.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-10 text-center">
        <CalendarClock className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-ink">No bookings yet</p>
        <p className="mt-1 text-sm text-neutral-500">
          Bookings customers make at this shop will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-2">
      {bookings.map((b) => {
        const status = b.status ?? "upcoming";
        return (
          <li
            key={b.id}
            className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">
                {b.date}
                {b.time ? ` · ${b.time}` : ""}
              </p>
              <p className="mt-0.5 truncate text-xs text-neutral-500">
                {b.services.length
                  ? b.services.map((s) => s.name ?? t(s.id)).join(", ")
                  : "No services"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-ink">{formatVnd(b.total)}</p>
              <span
                className={cx(
                  "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-bold capitalize",
                  STATUS_STYLES[status] ?? STATUS_STYLES.upcoming
                )}
              >
                {status}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
