"use client";

import { useEffect, useMemo, useState } from "react";
import { images } from "../assets.js";
import { services as serviceCatalog } from "../data/catalog.js";
import { cx } from "../lib/cx.js";
import { formatVnd } from "../lib/booking.js";
import { computeHoursModel } from "../lib/hours.js";
import { Icon } from "./ui/Icon.jsx";

export function NearbyCard({ shop, t, onSelect }) {
  // Imported, info-only listing (not a Washgo partner yet) — no price / booking.
  const isDirectory = shop.listingType === "directory";
  const shopServices = shop.services
    .map((id) => serviceCatalog.find((service) => service.id === id))
    .filter(Boolean);

  // Time-based open state is computed client-side only (null on the server / first
  // render → falls back to the stored flag), keeping hydration stable. Same logic
  // and look as the explore detail modal and list cards.
  const [now, setNow] = useState(null);
  useEffect(() => setNow(new Date()), []);
  const model = useMemo(() => (now ? computeHoursModel(shop, now, t) : null), [shop, now, t]);
  const known = Boolean(model?.known);
  const isOpen = known ? model.isOpen : shop.open;

  return (
    <button
      type="button"
      onClick={() => onSelect(shop.id)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative h-32 w-full overflow-hidden bg-neutral-100">
        <img
          src={shop.imageUrl || images.hero}
          alt={`${shop.name} ${t("washBayAlt")}`}
          className={`h-full w-full object-cover ${shop.imageUrl ? "object-center" : shop.imagePosition}`}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <h3 className="truncate font-display text-base font-black leading-tight text-ink">{shop.name}</h3>

        {/* Rating — amber star, matching the detail modal / list cards. */}
        <div className="flex items-center gap-1.5 text-[0.72rem]">
          <span className="inline-flex items-center gap-1 font-bold text-ink">
            <Icon name="Star" className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {shop.rating}
          </span>
          <span className="text-neutral-500">({shop.reviews})</span>
        </div>

        {/* Open state + nearest transition + distance — same treatment as the modal. */}
        <p className="flex flex-wrap items-center gap-x-1.5 text-[0.7rem] text-neutral-500">
          <span className={cx("font-bold", isOpen ? "text-emerald-600" : "text-rose-600")}>
            {isOpen ? t("open") : t("closed")}
          </span>
          {known && model.detail ? (
            <>
              <span className="text-neutral-300">·</span>
              <span>{model.detail}</span>
            </>
          ) : !known && shop.hours ? (
            <>
              <span className="text-neutral-300">·</span>
              <span>{shop.hours}</span>
            </>
          ) : null}
          {shop.distance ? (
            <>
              <span className="text-neutral-300">·</span>
              <span>{shop.distance}</span>
            </>
          ) : null}
        </p>

        <p className="truncate text-[0.7rem] text-neutral-500">{shop.address}</p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          {isDirectory ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-black text-amber-700">
              <Icon name="Info" className="h-3 w-3" />
              {t("infoOnly")}
            </span>
          ) : (
            <span className="text-xs font-semibold text-neutral-700">
              {t("from")} {formatVnd(shop.starting)}
            </span>
          )}
          {shopServices.length ? (
            <span className="flex items-center gap-1 text-neutral-400">
              {shopServices.slice(0, 3).map((service) => (
                <Icon key={service.id} name={service.icon} className="h-3.5 w-3.5" />
              ))}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
