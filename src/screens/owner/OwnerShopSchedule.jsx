"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { createClient } from "../../lib/supabase/client.js";
import {
  deleteSlotOverride,
  fetchSlotOverrides,
  setSlotOverride
} from "../../lib/data/api.js";
import { Button } from "../../components/ui/Button.jsx";

// Special-day overrides: mark a date closed or give it a custom per-slot cap.
// These take priority over the shop's normal max-cars limit (enforced in the
// create_booking RPC).
export function OwnerShopSchedule({ shop }) {
  const supabase = useMemo(() => createClient(), []);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [mode, setMode] = useState("closed"); // "closed" | "cap"
  const [cap, setCap] = useState(1);
  const [busy, setBusy] = useState(false);

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

  async function add() {
    if (!date) return;
    setBusy(true);
    try {
      await setSlotOverride(supabase, shop.id, date, {
        isClosed: mode === "closed",
        maxCars: mode === "cap" ? Math.max(1, Number(cap)) : null
      });
      setDate("");
      await reload();
    } catch (err) {
      console.error("[washgo] save override failed", err);
      window.alert(err?.message || "Could not save the override.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(d) {
    setBusy(true);
    try {
      await deleteSlotOverride(supabase, shop.id, d);
      await reload();
    } catch (err) {
      console.error("[washgo] delete override failed", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-1 text-sm text-neutral-600">
        Normal capacity is <strong>{shop.max_cars_per_slot ?? 1}</strong> car(s) per slot.
        Add specific days that are closed or have a different limit — these override the normal limit.
      </p>

      <div className="mt-4 grid gap-3 rounded-2xl border border-black/10 bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="grid gap-1">
          <span className="text-xs font-black uppercase tracking-wide text-neutral-500">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-11 rounded-2xl border border-black/10 px-3 text-sm outline-none focus:border-wash-500"
          />
        </label>
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
        <Button onClick={add} disabled={!date || busy} className="min-h-11">
          Add
        </Button>
      </div>

      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : overrides.length === 0 ? (
          <p className="text-sm text-neutral-400">No special days set.</p>
        ) : (
          <ul className="grid gap-2">
            {overrides.map((o) => (
              <li
                key={o.date}
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3"
              >
                <span className="text-sm font-bold text-ink">{o.date}</span>
                <span className="text-sm text-neutral-500">
                  {o.is_closed ? "Closed" : `${o.max_cars_per_slot} car(s)/slot`}
                </span>
                <button
                  type="button"
                  onClick={() => remove(o.date)}
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
  );
}
