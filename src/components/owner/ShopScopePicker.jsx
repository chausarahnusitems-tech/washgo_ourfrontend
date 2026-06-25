"use client";

import { cx } from "../../lib/cx.js";

// Pill row that scopes the owner dashboard to "all shops" (the default overall
// view) or a single shop. Only rendered when the owner has more than one shop —
// a single-shop owner keeps the plain overall dashboard.
export function ShopScopePicker({ shops, value, onChange, allLabel }) {
  const pill = (active) =>
    cx(
      "rounded-full px-3 py-1.5 text-xs font-bold transition",
      active
        ? "bg-wash-50 text-wash-600 ring-1 ring-wash-200"
        : "text-neutral-500 hover:bg-neutral-100"
    );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => onChange("all")} className={pill(value === "all")}>
        {allLabel}
      </button>
      {shops.map((shop) => (
        <button
          key={shop.id}
          type="button"
          onClick={() => onChange(shop.id)}
          className={pill(value === shop.id)}
        >
          {shop.name || shop.id}
        </button>
      ))}
    </div>
  );
}
