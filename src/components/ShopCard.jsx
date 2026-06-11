"use client";

import { images } from "../assets.js";
import { cx } from "../lib/cx.js";
import { formatVnd } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { Icon } from "./ui/Icon.jsx";
import { IconButton } from "./ui/Button.jsx";

export function ShopCard({ shop, t, onSelect, onQuickView, active = false }) {
  const { state, toggleFavorite } = useApp();
  const isFav = (state.favorites ?? []).includes(shop.id);

  return (
    <article
      className={cx(
        "grid grid-cols-[84px_1fr] gap-3 rounded-[18px] border bg-white p-2 transition",
        active ? "border-wash-500 ring-2 ring-wash-200" : "border-black/10"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(shop.id)}
        className="relative h-[84px] overflow-hidden rounded-xl bg-neutral-100"
      >
        <img src={images.hero} alt={`${shop.name} ${t("washBayAlt")}`} className={`h-full w-full object-cover ${shop.imagePosition}`} />
        {shop.promo ? (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-wash-500 px-2 py-1 text-[0.56rem] font-black text-white">
            {t("freeWash")}
          </span>
        ) : null}
      </button>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelect(shop.id)}
            className="min-h-7 min-w-0 bg-transparent p-0 text-left font-display text-base font-black leading-tight text-ink"
          >
            {shop.name}
          </button>
          <div className="flex shrink-0 items-center">
            {onQuickView ? (
              <IconButton label={t("quickView")} onClick={() => onQuickView(shop.id)} className="h-9 w-9">
                <Icon name="Eye" className="h-5 w-5" />
              </IconButton>
            ) : null}
            <IconButton
              label={isFav ? t("saved") : t("save")}
              aria-pressed={isFav}
              onClick={() => toggleFavorite(shop.id)}
              className="h-9 w-9"
            >
              <Icon name="Heart" className={cx("h-5 w-5", isFav && "fill-wash-500 text-wash-500")} />
            </IconButton>
          </div>
        </div>
        <p className="mt-1 text-xs text-neutral-600">
          <span
            className={cx(
              "rounded px-1 text-[0.62rem] font-black text-white",
              shop.open ? "bg-emerald-500" : "bg-neutral-400"
            )}
          >
            {shop.open ? t("open") : t("closed")}
          </span>
          {" · "}
          {shop.hours ?? t("hours")} · {shop.distance}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.7rem] text-wash-500">
          <span className="inline-flex items-center gap-1">
            <Icon name="Star" className="h-3.5 w-3.5" />
            {shop.rating} ({shop.reviews})
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="Clock" className="h-3.5 w-3.5" />
            {shop.wait}
          </span>
          <strong className="text-ink">
            {t("from")} {formatVnd(shop.starting)}
          </strong>
        </div>
      </div>
    </article>
  );
}
