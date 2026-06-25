"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { images } from "../assets.js";
import { cx } from "../lib/cx.js";
import { formatVnd } from "../lib/booking.js";
import { computeHoursModel } from "../lib/hours.js";
import { useApp } from "../lib/AppContext.jsx";
import { Icon } from "./ui/Icon.jsx";
import { IconButton } from "./ui/Button.jsx";

export function ShopCard({ shop, t, onSelect, active = false }) {
  const router = useRouter();
  const { state, toggleFavorite, requireAuth } = useApp();
  const isFav = (state.favorites ?? []).includes(shop.id);
  // Imported, info-only listing (not a Washgo partner yet) — no price / booking.
  const isDirectory = shop.listingType === "directory";

  // The "open now / closes at" state depends on the current time, so it's computed
  // client-side only: `now` is null on the server and first client render (both fall
  // back to the stored `open` flag, keeping hydration stable) and upgrades to the
  // schedule-derived state after mount — matching the explore detail modal.
  const [now, setNow] = useState(null);
  useEffect(() => setNow(new Date()), []);
  const model = useMemo(() => (now ? computeHoursModel(shop, now, t) : null), [shop, now, t]);
  const known = Boolean(model?.known);
  const isOpen = known ? model.isOpen : shop.open;

  const onToggleFav = (e) => {
    e.stopPropagation();
    if (requireAuth) {
      router.push("/login");
      return;
    }
    toggleFavorite(shop.id);
  };

  const onCardActivate = () => onSelect(shop.id);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onCardActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardActivate();
        }
      }}
      className={cx(
        "grid cursor-pointer grid-cols-[84px_1fr] gap-3 rounded-[18px] border bg-white p-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-wash-300",
        active ? "border-wash-500 ring-2 ring-wash-200" : "border-black/10"
      )}
    >
      <div className="relative h-[84px] overflow-hidden rounded-xl bg-neutral-100">
        <img
          src={shop.imageUrl || images.hero}
          alt={`${shop.name} ${t("washBayAlt")}`}
          className={`h-full w-full object-cover ${shop.imageUrl ? "object-center" : shop.imagePosition}`}
        />
        {shop.promo ? (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-wash-500 px-2 py-1 text-[0.56rem] font-black text-white">
            {t("freeWash")}
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-h-7 min-w-0 font-display text-base font-black leading-tight text-ink">
            {shop.name}
          </h3>
          <div className="flex shrink-0 items-center">
            <IconButton
              label={isFav ? t("saved") : t("save")}
              aria-pressed={isFav}
              onClick={onToggleFav}
              className="h-9 w-9"
            >
              <Icon name="Heart" className={cx("h-5 w-5", isFav && "fill-wash-500 text-wash-500")} />
            </IconButton>
          </div>
        </div>

        {/* Rating + min price — same treatment as the detail modal header. */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className="inline-flex items-center gap-1 font-bold text-ink">
            <Icon name="Star" className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {shop.rating}
          </span>
          <span className="text-neutral-500">({shop.reviews})</span>
          {isDirectory ? (
            <>
              <span className="text-neutral-300">·</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.62rem] font-black text-amber-700">
                <Icon name="Info" className="h-3 w-3" />
                {t("infoOnly")}
              </span>
            </>
          ) : (
            <>
              <span className="text-neutral-300">·</span>
              <span className="font-semibold text-neutral-700">
                {t("from")} {formatVnd(shop.starting)}
              </span>
            </>
          )}
        </div>

        {/* Open state + nearest transition + distance — same treatment as the modal. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-500">
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
      </div>
    </article>
  );
}
