"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

// Grab-maps-style address autocomplete backed by OpenStreetMap Nominatim (free,
// no API key). Debounced to respect Nominatim's ~1 req/sec policy. On select it
// reports the formatted address + lat/lng so the shop form fills the address and
// drops the map pin.
export function AddressSearch({ onSelect, className }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 3) {
      setResults([]);
      return undefined;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(term)}`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => timer.current && clearTimeout(timer.current);
  }, [q]);

  function choose(item) {
    onSelect?.({
      address: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon)
    });
    setQ(item.display_name);
    setOpen(false);
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="flex items-center gap-2 rounded-2xl border border-black/10 px-3">
        <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search an address…"
          className="min-h-11 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {loading && <p className="mt-1 text-xs text-neutral-400">Searching…</p>}
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-black/10 bg-white shadow-device">
          {results.map((item) => (
            <li key={item.place_id}>
              <button
                type="button"
                onClick={() => choose(item)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
              >
                {item.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 00:00 … 23:30 (or any step) option list for the open/close <select>s.
export function timeOptions(stepMinutes = 30) {
  const out = [];
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}
