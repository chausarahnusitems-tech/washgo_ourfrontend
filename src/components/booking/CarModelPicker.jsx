"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CAR_MODEL_OPTIONS } from "../../data/carModels.js";
import { foldAccents } from "../../lib/booking.js";
import { Icon } from "../ui/Icon.jsx";

// Scroll-to-select car model picker (item 2). Backed by the curated
// Vietnam-focused make+model dataset. It filters as you type (diacritic-
// insensitive) and shows a scrollable list; picking sets the value. Free text is
// still allowed (so a model not in the list can be typed and used as-is).
export function CarModelPicker({ value, onSelect, t, placeholder }) {
  const [query, setQuery] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // Keep the field in sync if the value is changed elsewhere (e.g. hydrated from
  // the profile) while the user isn't actively editing.
  useEffect(() => {
    if (!open) setQuery(value ?? "");
  }, [value, open]);

  const results = useMemo(() => {
    const needle = foldAccents(query.trim());
    const all = needle
      ? CAR_MODEL_OPTIONS.filter((model) => foldAccents(model).includes(needle))
      : CAR_MODEL_OPTIONS;
    return all.slice(0, 80);
  }, [query]);

  const choose = (model) => {
    setQuery(model);
    onSelect(model);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onSelect(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="mt-1 min-h-11 w-full rounded-xl border border-black/10 bg-neutral-100 px-3 pr-9 outline-none focus:ring-4 focus:ring-wash-500/20"
        />
        <Icon name="ChevronDown" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      </div>
      {open ? (
        <ul className="absolute z-20 mt-1 max-h-60 w-full snap-y overflow-y-auto rounded-xl border border-black/10 bg-white shadow-lg">
          {results.length ? (
            results.map((model) => (
              <li key={model}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(model)}
                  className={`flex w-full snap-start items-center gap-2 px-3 py-2 text-left text-sm hover:bg-wash-50 ${
                    model === value ? "bg-wash-50 font-bold text-wash-600" : ""
                  }`}
                >
                  <Icon name="Car" className="h-4 w-4 text-neutral-400" />
                  {model}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-neutral-400">
              {t ? t("noModelMatch") : "No match — keep typing or use it as-is"}
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
