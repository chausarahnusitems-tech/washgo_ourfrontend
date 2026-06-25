"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, ScanLine, TriangleAlert } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { createClient } from "../../lib/supabase/client.js";
import { fetchAdminPlateMismatches } from "../../lib/data/api.js";
import { parseIsoDate } from "../../lib/calendar.js";

// Admin view of completed bookings whose scanned plate didn't match the plate
// registered on the booking. Data comes from the admin_plate_mismatches RPC
// (admins have no direct SELECT on bookings). Admin-area strings are hardcoded
// English, consistent with the rest of the moderation console.
export function AdminPlateChecksScreen() {
  const { lang } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetchAdminPlateMismatches(supabase)
      .then((data) => active && setRows(data ?? []))
      .catch((err) => {
        console.error("[washgo] load plate mismatches failed", err);
        if (active) setError(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [supabase]);

  const fmtDate = (iso) => {
    const d = parseIsoDate(iso) ?? (iso ? new Date(iso) : null);
    return d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : iso;
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <header>
        <h1 className="font-display text-2xl font-black">Plate checks</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Completed washes where the scanned plate didn&apos;t match the plate registered on the booking.
        </p>
      </header>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading…</p>
      ) : error ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-12 text-center">
          <TriangleAlert className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">Couldn&apos;t load plate checks. Please try again.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-12 text-center">
          <ScanLine className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">No plate mismatches.</p>
          <p className="mt-1 text-sm text-neutral-500">Every completed wash matched its registered plate.</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-2">
          {rows.map((r) => (
            <li key={r.booking_id} className="rounded-2xl border border-black/5 bg-white p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-amber-600">
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" /> Mismatch
                </span>
                <span className="text-sm font-bold text-ink">{r.shop_name ?? r.shop_id}</span>
                <span className="text-xs text-neutral-500">
                  {fmtDate(r.scheduled_date)} · {r.slot_time}
                </span>
                {r.completion_photo_url && (
                  <a
                    href={r.completion_photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Completion photo
                  </a>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-600">
                <span>
                  Registered: <strong className="text-ink">{r.expected_plate || "—"}</strong>
                </span>
                <span>
                  Scanned: <strong className="text-amber-700">{r.scanned_plate || "—"}</strong>
                </span>
                {r.customer_name && (
                  <span>
                    Customer: <strong className="text-ink">{r.customer_name}</strong>
                    {r.customer_phone ? ` · ${r.customer_phone}` : ""}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
