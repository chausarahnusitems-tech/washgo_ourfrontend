"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { cx } from "../../lib/cx.js";
import { Button } from "../../components/ui/Button.jsx";
import { formatVnd } from "./format.js";

// Pick which catalog services this shop offers. Persists the whole selection to
// the shop_services join table via saveServices (which reconciles add/remove).
export function OwnerShopServices({ shop, saveServices }) {
  const { catalog, t } = useApp();
  const services = catalog.services ?? [];
  const [selected, setSelected] = useState(() => new Set(shop.serviceIds ?? []));
  const [status, setStatus] = useState(null); // null | "saving" | "saved" | error

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setStatus(null);
  }

  async function save() {
    setStatus("saving");
    try {
      await saveServices(shop.id, [...selected]);
      setStatus("saved");
    } catch (err) {
      console.error("[washgo] save services failed", err);
      setStatus(err?.message || "Could not save services.");
    }
  }

  if (services.length === 0) {
    return <p className="text-sm text-neutral-500">No services available in the catalog.</p>;
  }

  return (
    <div>
      <p className="mb-3 text-sm text-neutral-500">
        Select the services customers can book at this shop.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {services.map((service) => {
          const on = selected.has(service.id);
          return (
            <li key={service.id}>
              <button
                type="button"
                onClick={() => toggle(service.id)}
                aria-pressed={on}
                className={cx(
                  "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                  on ? "border-wash-300 bg-wash-50" : "border-black/10 bg-white hover:bg-neutral-50"
                )}
              >
                <span
                  className={cx(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                    on ? "border-wash-500 bg-wash-500 text-white" : "border-black/20 text-transparent"
                  )}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">
                    {t(service.id)}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {formatVnd(service.price)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save services"}
        </Button>
        {status === "saved" && (
          <span className="text-sm font-semibold text-emerald-600">Saved</span>
        )}
        {status && !["saving", "saved"].includes(status) && (
          <span className="text-sm text-red-600">{status}</span>
        )}
      </div>
    </div>
  );
}
