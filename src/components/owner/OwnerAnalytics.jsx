"use client";

import { useMemo, useState } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { parseSlotTime } from "../../lib/booking.js";
import { parseIsoDate } from "../../lib/calendar.js";
import { cx } from "../../lib/cx.js";

// Date-range options for the analytics window. `months: null` = all time.
const RANGE_OPTIONS = [
  { key: "month", labelKey: "rangeThisMonth" },
  { key: "3m", labelKey: "range3m" },
  { key: "6m", labelKey: "range6m" },
  { key: "1y", labelKey: "range1y" },
  { key: "all", labelKey: "rangeAll" }
];

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The inclusive lower-bound ISO date for a range, or null for "all time".
function rangeStartIso(range) {
  const now = new Date();
  if (range === "month") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const months = { "3m": 3, "6m": 6, "1y": 12 }[range];
  if (!months) return null; // all
  return isoLocal(new Date(now.getFullYear(), now.getMonth() - months, now.getDate()));
}

// A list of horizontal bars (label · track · value). Hand-built with Tailwind —
// the codebase has no charting dependency, and these histograms don't need one.
function BarList({ rows, max, accent = "bg-wash-500" }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3">
          <span className="w-20 shrink-0 truncate text-xs font-semibold text-neutral-600" title={r.label}>
            {r.label}
          </span>
          <div className="h-2.5 flex-1 rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full ${accent}`}
              style={{ width: `${max > 0 && r.value > 0 ? Math.max(5, (r.value / max) * 100) : 0}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, sub, className = "", children }) {
  return (
    <div className={`rounded-2xl border border-black/5 bg-white p-5 ${className}`}>
      <h3 className="text-sm font-black text-ink">{title}</h3>
      <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

// Owner analytics computed client-side from the already-fetched bookings (same
// approach the dashboard uses for its revenue/count cards). Cancelled bookings
// are excluded — they aren't real washes. A date-range filter narrows the window
// (client-side filter on the booking's scheduled date).
export function OwnerAnalytics({ bookings }) {
  const { t, lang } = useApp();
  const locale = lang === "vi" ? "vi-VN" : "en-US";
  const [range, setRange] = useState("all");

  const fromIso = rangeStartIso(range);
  const active = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.status !== "cancelled" &&
          b.status !== "missed" &&
          (!fromIso || (b.date && b.date >= fromIso))
      ),
    [bookings, fromIso]
  );

  // Service utilisation — count each service across active bookings. Catalogue
  // lines label via i18n (t(id)); custom-service lines carry their own name.
  const services = useMemo(() => {
    const map = new Map();
    for (const b of active) {
      for (const s of b.services ?? []) {
        const key = s.id ?? s.name;
        if (!key) continue;
        const entry = map.get(key) ?? { key, label: s.name ?? t(s.id), value: 0 };
        entry.value += 1;
        map.set(key, entry);
      }
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [active, t]);

  // Peak hours — bucket by hour-of-day parsed from the slot label.
  const hours = useMemo(() => {
    const counts = new Map();
    for (const b of active) {
      const slot = parseSlotTime(b.time);
      if (!slot) continue;
      counts.set(slot.hours, (counts.get(slot.hours) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([h, value]) => ({ key: `h${h}`, label: `${String(h).padStart(2, "0")}:00`, value }));
  }, [active]);

  // Busiest days — bucket by weekday from the scheduled date (Mon..Sun layout).
  const days = useMemo(() => {
    const counts = new Array(7).fill(0);
    for (const b of active) {
      const d = parseIsoDate(b.date) ?? (b.date ? new Date(b.date) : null);
      if (!d || Number.isNaN(d.getTime())) continue;
      counts[d.getDay()] += 1;
    }
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((i) => ({
      key: `d${i}`,
      label: new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: "short" }),
      value: counts[i]
    }));
  }, [active, locale]);

  const maxService = services.reduce((m, r) => Math.max(m, r.value), 0);
  const maxHour = hours.reduce((m, r) => Math.max(m, r.value), 0);
  const maxDay = days.reduce((m, r) => Math.max(m, r.value), 0);
  const hasData = active.length > 0 && (services.length > 0 || hours.length > 0 || maxDay > 0);

  const rangePills = (
    <div className="flex flex-wrap gap-1.5">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => setRange(opt.key)}
          className={cx(
            "rounded-full px-3 py-1.5 text-xs font-bold transition",
            range === opt.key
              ? "bg-wash-50 text-wash-600 ring-1 ring-wash-200"
              : "text-neutral-500 hover:bg-neutral-100"
          )}
        >
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  );

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-wide text-neutral-500">
          {t("ownerAnalyticsHeading")}
        </h2>
        {rangePills}
      </div>

      {!hasData ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-10 text-center">
          <p className="text-sm text-neutral-500">{t("ownerAnalyticsEmpty")}</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title={t("ownerServiceUtilization")} sub={t("ownerServiceUtilizationSub")}>
            {services.length ? (
              <BarList rows={services} max={maxService} />
            ) : (
              <p className="text-xs text-neutral-400">{t("ownerAnalyticsEmpty")}</p>
            )}
          </Panel>
          <Panel title={t("ownerPeakHours")} sub={t("ownerPeakHoursSub")}>
            {hours.length ? (
              <BarList rows={hours} max={maxHour} accent="bg-wash-400" />
            ) : (
              <p className="text-xs text-neutral-400">{t("ownerAnalyticsEmpty")}</p>
            )}
          </Panel>
          <Panel title={t("ownerBusiestDays")} sub={t("ownerBusiestDaysSub")} className="lg:col-span-2">
            <BarList rows={days} max={maxDay} accent="bg-wash-600" />
          </Panel>
        </div>
      )}
    </section>
  );
}
