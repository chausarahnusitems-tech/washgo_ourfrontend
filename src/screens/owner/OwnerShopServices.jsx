"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Tag, Trash2 } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { createClient } from "../../lib/supabase/client.js";
import {
  addCustomService,
  fetchCustomServices,
  removeCustomService
} from "../../lib/data/api.js";
import { cx } from "../../lib/cx.js";
import { Button } from "../../components/ui/Button.jsx";
import { formatVnd } from "./format.js";
import { SERVICE_OPTION_GROUPS, CUSTOM_SERVICE, SERVICE_PRICE_BY_NAME } from "../../data/serviceOptions.js";

// Two parts: pick from the shared catalogue (persisted to shop_services), and
// add fully custom services (name + price, optionally flagged as an "offer").
export function OwnerShopServices({ shop, saveServices }) {
  const { catalog, t } = useApp();
  const services = catalog.services ?? [];
  const supabase = useMemo(() => createClient(), []);

  const [selected, setSelected] = useState(() => new Set(shop.serviceIds ?? []));
  const [status, setStatus] = useState(null);

  // Custom services
  const [custom, setCustom] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [isOffer, setIsOffer] = useState(false);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState("");

  // Pick a service from the common (WÜRTH-style) menu to pre-fill name + price,
  // or "Other" to type a fully custom one. The fields stay editable after.
  function onPickSuggestion(value) {
    setPicked(value);
    if (!value) return;
    if (value === CUSTOM_SERVICE) {
      setName("");
      return;
    }
    setName(value);
    const suggested = SERVICE_PRICE_BY_NAME[value];
    if (suggested != null) setPrice(String(suggested));
  }

  useEffect(() => {
    fetchCustomServices(supabase, shop.id)
      .then(setCustom)
      .catch((err) => console.error("[washgo] fetch custom services failed", err));
  }, [supabase, shop.id]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setStatus(null);
  }

  async function saveCatalogue() {
    setStatus("saving");
    try {
      await saveServices(shop.id, [...selected]);
      setStatus("saved");
    } catch (err) {
      console.error("[washgo] save services failed", err);
      setStatus(err?.message || "Could not save services.");
    }
  }

  async function addService() {
    const value = Math.round(Number(price));
    if (!name.trim() || !Number.isFinite(value) || value < 0) return;
    setAdding(true);
    try {
      const row = await addCustomService(supabase, shop.id, {
        name: name.trim(),
        price: value,
        isOffer
      });
      setCustom((prev) => [...prev, row]);
      setName("");
      setPrice("");
      setIsOffer(false);
      setPicked("");
    } catch (err) {
      console.error("[washgo] add custom service failed", err);
      window.alert(err?.message || "Could not add the service.");
    } finally {
      setAdding(false);
    }
  }

  async function deleteService(id) {
    try {
      await removeCustomService(supabase, id);
      setCustom((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("[washgo] remove custom service failed", err);
    }
  }

  return (
    <div className="grid gap-8">
      {/* Shared catalogue */}
      <section>
        <h3 className="text-sm font-black uppercase tracking-wide text-neutral-500">
          From the catalogue
        </h3>
        <p className="mt-1 mb-3 text-sm text-neutral-500">
          Select the standard services customers can book at this shop.
        </p>
        {services.length === 0 ? (
          <p className="text-sm text-neutral-400">No catalogue services available.</p>
        ) : (
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
                      <span className="block truncate text-sm font-bold text-ink">{t(service.id)}</span>
                      <span className="block text-xs text-neutral-500">{formatVnd(service.price)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={saveCatalogue} disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save catalogue services"}
          </Button>
          {status === "saved" && <span className="text-sm font-semibold text-emerald-600">Saved</span>}
          {status && !["saving", "saved"].includes(status) && (
            <span className="text-sm text-red-600">{status}</span>
          )}
        </div>
      </section>

      {/* Custom services */}
      <section>
        <h3 className="text-sm font-black uppercase tracking-wide text-neutral-500">
          Your own services
        </h3>
        <p className="mt-1 mb-3 text-sm text-neutral-500">
          Pick from the common menu to pre-fill the name and a suggested price, or add your own.
          Flag any that are special offers.
        </p>

        {custom.length > 0 && (
          <ul className="mb-4 grid gap-2">
            {custom.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-bold text-ink">
                    {c.name}
                    {c.is_offer && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2 py-0.5 text-[0.62rem] font-black text-lime-700">
                        <Tag className="h-3 w-3" aria-hidden="true" /> Offer
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-neutral-500">{formatVnd(c.price)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteService(c.id)}
                  aria-label="Remove"
                  className="grid h-9 w-9 place-items-center rounded-full text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-neutral-500">
              Choose a common service
            </span>
            <select
              value={picked}
              onChange={(e) => onPickSuggestion(e.target.value)}
              className="min-h-11 rounded-2xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-wash-500"
            >
              <option value="">Pick from the menu…</option>
              {SERVICE_OPTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((o) => (
                    <option key={o.name} value={o.name}>
                      {o.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={CUSTOM_SERVICE}>Other (type your own)…</option>
            </select>
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-neutral-500">Service name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Engine bay cleaning"
              className="min-h-11 rounded-2xl border border-black/10 px-3 text-sm outline-none focus:border-wash-500"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase tracking-wide text-neutral-500">Price (₫)</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="50000"
              className="min-h-11 w-32 rounded-2xl border border-black/10 px-3 text-sm outline-none focus:border-wash-500"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={isOffer} onChange={(e) => setIsOffer(e.target.checked)} className="h-4 w-4" />
            Offer
          </label>
          <Button onClick={addService} disabled={adding || !name.trim() || price === ""} className="min-h-11">
            {adding ? "…" : "Add service"}
          </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
