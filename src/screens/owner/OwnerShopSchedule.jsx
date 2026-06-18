"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { createClient } from "../../lib/supabase/client.js";
import {
  deleteSlotOverride,
  fetchSlotOverrides,
  setSlotOverride
} from "../../lib/data/api.js";
import {
  addMonths,
  buildMonthGrid,
  formatMonthLabel,
  toIsoDate,
  WEEKDAYS_SHORT
} from "../../lib/calendar.js";
import { Icon } from "../../components/ui/Icon.jsx";
import { Button } from "../../components/ui/Button.jsx";

// Special-day overrides on a real month calendar (item 20): tap a date to close
// the shop or give it a custom per-slot cap. Closures/caps take priority over
// the normal limit (enforced server-side in create_booking). The data model
// (shop_slot_overrides) and RPCs already exist — this just gives owners a proper
// calendar instead of a single date input.
export function OwnerShopSchedule({ shop, update }) {
  const supabase = useMemo(() => createClient(), []);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(null); // iso date the owner tapped
  const [mode, setMode] = useState("closed"); // "closed" | "cap"
  const [cap, setCap] = useState(1);

  async function reload() {
    setLoading(true);
    try {
      setOverrides(await fetchSlotOverrides(supabase, shop.id));
    } catch (err) {
      console.error("[washgo] fetch overrides failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.id]);

  // date -> override row, for quick calendar lookups.
  const byDate = useMemo(() => {
    const map = new Map();
    overrides.forEach((o) => map.set(o.date, o));
    return map;
  }, [overrides]);

  const now = new Date();
  const todayIso = toIsoDate(now);
  const atCurrentMonth =
    viewMonth.getFullYear() === now.getFullYear() && viewMonth.getMonth() === now.getMonth();
  const grid = buildMonthGrid(viewMonth.getFullYear(), viewMonth.getMonth());

  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      await setSlotOverride(supabase, shop.id, selected, {
        isClosed: mode === "closed",
        maxCars: mode === "cap" ? Math.max(1, Number(cap)) : null
      });
      setSelected(null);
      await reload();
    } catch (err) {
      console.error("[washgo] save override failed", err);
      window.alert(err?.message || "Could not save the override.");
    } finally {
      setBusy(false);
    }
  }

  async function clearDay(iso) {
    setBusy(true);
    try {
      await deleteSlotOverride(supabase, shop.id, iso);
      if (selected === iso) setSelected(null);
      await reload();
    } catch (err) {
      console.error("[washgo] delete override failed", err);
    } finally {
      setBusy(false);
    }
  }

  function pickDay(iso) {
    const existing = byDate.get(iso);
    setSelected(iso);
    if (existing) {
      setMode(existing.is_closed ? "closed" : "cap");
      setCap(existing.max_cars_per_slot ?? 1);
    } else {
      setMode("closed");
      setCap(1);
    }
  }

  const upcoming = overrides.filter((o) => o.date >= todayIso);

  return (
    <div className="grid gap-8">
      <WeeklyHoursEditor shop={shop} update={update} />

      <div>
      <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-neutral-500">Special days</h3>
      <p className="mb-1 text-sm text-neutral-600">
        Normal capacity is <strong>{shop.max_cars_per_slot ?? 1}</strong> car(s) per slot. Tap a date
        to close the shop or set a custom limit — these override the normal limit.
      </p>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
        {/* Month switcher */}
        <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
            disabled={atCurrentMonth}
            aria-label="Previous month"
            className="grid h-9 w-10 place-items-center rounded-lg border border-black/10 disabled:opacity-40"
          >
            <Icon name="ArrowLeft" className="h-4 w-4" />
          </button>
          <strong className="text-center font-display text-base font-black">{formatMonthLabel(viewMonth)}</strong>
          <button
            type="button"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
            className="grid h-9 w-10 place-items-center rounded-lg border border-black/10"
          >
            <Icon name="ArrowLeft" className="h-4 w-4 rotate-180" />
          </button>
        </div>

        {/* Day grid */}
        <div className="mt-3 grid grid-cols-7 gap-1">
          {WEEKDAYS_SHORT.map((day) => (
            <span key={day} className="text-center text-[0.7rem] font-black text-neutral-400">
              {day}
            </span>
          ))}
          {grid.map((cell) => {
            const override = byDate.get(cell.iso);
            const disabled = cell.muted || cell.past;
            const isSelected = cell.iso === selected;
            const closed = override?.is_closed;
            const capped = override && !override.is_closed;
            return (
              <button
                key={cell.iso}
                type="button"
                disabled={disabled}
                onClick={() => pickDay(cell.iso)}
                className={cx(
                  "relative grid min-h-10 place-items-center rounded-lg text-sm font-bold transition",
                  disabled
                    ? "text-neutral-300"
                    : isSelected
                      ? "ring-2 ring-wash-500"
                      : "hover:bg-neutral-100",
                  closed ? "bg-red-100 text-red-700" : capped ? "bg-amber-100 text-amber-700" : "text-ink"
                )}
              >
                {cell.day}
                {override ? (
                  <span
                    className={cx(
                      "absolute bottom-1 h-1 w-1 rounded-full",
                      closed ? "bg-red-500" : "bg-amber-500"
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-red-100 ring-1 ring-red-300" /> Closed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-300" /> Custom limit
          </span>
        </div>
      </div>

      {/* Inline editor for the tapped day */}
      {selected ? (
        <div className="mt-3 grid gap-3 rounded-2xl border border-wash-200 bg-wash-50/60 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div>
            <span className="text-xs font-black uppercase tracking-wide text-neutral-500">Selected date</span>
            <p className="mt-1 text-sm font-bold text-ink">{selected}</p>
          </div>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-neutral-500">Rule</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="min-h-11 rounded-2xl border border-black/10 px-3 text-sm outline-none focus:border-wash-500"
            >
              <option value="closed">Closed</option>
              <option value="cap">Custom limit</option>
            </select>
          </label>
          {mode === "cap" && (
            <label className="grid gap-1">
              <span className="text-xs font-black uppercase tracking-wide text-neutral-500">Cars/slot</span>
              <input
                type="number"
                min="1"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                className="min-h-11 w-24 rounded-2xl border border-black/10 px-3 text-sm outline-none focus:border-wash-500"
              />
            </label>
          )}
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy} className="min-h-11">
              Save
            </Button>
            {byDate.get(selected) ? (
              <Button variant="ghost" className="min-h-11 text-red-600 hover:bg-red-50" disabled={busy} onClick={() => clearDay(selected)}>
                Clear
              </Button>
            ) : (
              <Button variant="ghost" className="min-h-11" disabled={busy} onClick={() => setSelected(null)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {/* Upcoming closures summary */}
      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-neutral-400">No upcoming special days set.</p>
        ) : (
          <ul className="grid gap-2">
            {upcoming.map((o) => (
              <li key={o.date} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3">
                <span className="text-sm font-bold text-ink">{o.date}</span>
                <span className="text-sm text-neutral-500">
                  {o.is_closed ? "Closed" : `${o.max_cars_per_slot} car(s)/slot`}
                </span>
                <button
                  type="button"
                  onClick={() => clearDay(o.date)}
                  disabled={busy}
                  aria-label="Remove"
                  className="ml-auto grid h-9 w-9 place-items-center rounded-full text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}

// Local class joiner (mirrors src/lib/cx for this self-contained screen).
function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

// Time options every 30 min, "HH:MM".
const HOUR_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

// Display order Mon..Sun (keys are 0=Sun..6=Sat to match Date.getDay()).
const WEEK_ORDER = [
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
  ["0", "Sunday"]
];

// Per-weekday opening hours editor (item: weekly schedule). Saves the jsonb
// weekly_hours map on the shop; a closed day blocks bookings that weekday.
function WeeklyHoursEditor({ shop, update }) {
  const defOpen = (shop.open_time ?? "08:00").slice(0, 5);
  const defClose = (shop.close_time ?? "18:00").slice(0, 5);
  const initial = () => {
    const wh = shop.weekly_hours || {};
    const out = {};
    for (const [key] of WEEK_ORDER) {
      const e = wh[key];
      out[key] = e
        ? { closed: Boolean(e.closed), open: e.open || defOpen, close: e.close || defClose }
        : { closed: false, open: defOpen, close: defClose };
    }
    return out;
  };
  const [days, setDays] = useState(initial);
  const [status, setStatus] = useState(null); // null | "saving" | "saved" | error

  function setDay(key, patch) {
    setDays((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setStatus(null);
  }

  async function save() {
    setStatus("saving");
    const weekly_hours = {};
    for (const [key] of WEEK_ORDER) {
      const d = days[key];
      weekly_hours[key] = d.closed ? { closed: true } : { open: d.open, close: d.close };
    }
    try {
      await update(shop.id, { weekly_hours });
      setStatus("saved");
    } catch (err) {
      console.error("[washgo] save weekly hours failed", err);
      setStatus(err?.message || "Could not save hours.");
    }
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-neutral-500">Weekly opening hours</h3>
      <p className="mb-3 text-sm text-neutral-600">
        Set the hours customers can book each day. Mark a day closed to block bookings that weekday.
      </p>
      <div className="grid gap-2">
        {WEEK_ORDER.map(([key, label]) => {
          const d = days[key];
          return (
            <div key={key} className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/10 bg-white p-3">
              <span className="w-24 shrink-0 text-sm font-bold text-ink">{label}</span>
              {d.closed ? (
                <span className="text-sm font-semibold text-neutral-400">Closed</span>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={d.open}
                    onChange={(e) => setDay(key, { open: e.target.value })}
                    className="min-h-10 rounded-xl border border-black/10 px-2 text-sm outline-none focus:border-wash-500"
                  >
                    {HOUR_OPTIONS.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
                  </select>
                  <span className="text-neutral-400">–</span>
                  <select
                    value={d.close}
                    onChange={(e) => setDay(key, { close: e.target.value })}
                    className="min-h-10 rounded-xl border border-black/10 px-2 text-sm outline-none focus:border-wash-500"
                  >
                    {HOUR_OPTIONS.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
                  </select>
                </div>
              )}
              <label className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-neutral-600">
                <input
                  type="checkbox"
                  checked={d.closed}
                  onChange={(e) => setDay(key, { closed: e.target.checked })}
                  className="h-4 w-4"
                />
                Closed
              </label>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save hours"}
        </Button>
        {status === "saved" && <span className="text-sm font-semibold text-emerald-600">Saved</span>}
        {status && !["saving", "saved"].includes(status) && <span className="text-sm text-red-600">{status}</span>}
      </div>
    </div>
  );
}
