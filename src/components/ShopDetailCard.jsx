import { useState } from "react";
import { images } from "../assets.js";
import { services as serviceCatalog } from "../data/catalog.js";
import { Icon } from "./ui/Icon.jsx";
import { Button, IconButton } from "./ui/Button.jsx";
import { cx } from "../lib/cx.js";

function ServiceChips({ shop, t }) {
  return (
    <div className="flex flex-wrap gap-2">
      {shop.services.map((id) => {
        const service = serviceCatalog.find((item) => item.id === id);
        return (
          <span
            key={id}
            className="inline-flex min-h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-xs font-bold text-neutral-600"
          >
            <Icon name={service?.icon ?? "Car"} className="h-4 w-4" />
            {t(id)}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The car-wash detail card shown on the map page. On desktop it floats next to
 * the sidebar list; on mobile it fills the bottom sheet. `onBack` (mobile)
 * returns to the list, `onClose` (desktop) dismisses the card.
 */
export function ShopDetailCard({ shop, t, onClose, onBack, onBook, variant = "desktop", className }) {
  const [expanded, setExpanded] = useState(false);
  if (!shop) return null;

  const isMobile = variant === "mobile";

  return (
    <article
      className={cx(
        "flex flex-col overflow-hidden bg-white",
        isMobile ? "h-full rounded-t-[22px]" : "rounded-[22px] shadow-device",
        className
      )}
    >
      <div className={cx("min-h-0 flex-1 overflow-y-auto", isMobile ? "px-5 pb-4 pt-4" : "p-5")}>
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 font-display text-2xl font-black leading-tight">{shop.name}</h1>
          <div className="flex shrink-0 gap-2">
            <IconButton label="Share" className="h-9 w-9 bg-neutral-100">
              <Icon name="Share2" className="h-5 w-5" />
            </IconButton>
            <IconButton label={t("quickView")} className="h-9 w-9 bg-neutral-100">
              <Icon name="Heart" className="h-5 w-5" />
            </IconButton>
            <IconButton
              label={t("close")}
              onClick={isMobile ? onBack : onClose}
              className="h-9 w-9 bg-neutral-100"
            >
              <Icon name={isMobile ? "ArrowLeft" : "X"} className="h-5 w-5" />
            </IconButton>
          </div>
        </div>

        <p className="mt-1 text-sm text-neutral-600">
          {t("hours")} <span className="text-neutral-400">·</span> {shop.distance}
        </p>
        <p className="mt-1 flex items-start gap-2 text-sm text-neutral-600">
          <Icon name="MapPin" className="mt-0.5 h-4 w-4 shrink-0" />
          {shop.address}
        </p>

        <img
          src={images.hero}
          alt={shop.name}
          className={cx(
            "mt-4 w-full rounded-xl object-cover object-[58%_center]",
            isMobile ? "h-48" : "h-44"
          )}
        />

        <h2 className="mt-4 font-display text-sm font-black text-neutral-600">{t("serviceIncluded")}</h2>
        <div className="mt-2">
          <ServiceChips shop={shop} t={t} />
        </div>

        {expanded ? (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-neutral-100 px-3 py-2">
              <dt className="text-[0.7rem] text-neutral-500">{t("recommended")}</dt>
              <dd className="flex items-center gap-1 font-bold text-wash-500">
                <Icon name="Star" className="h-3.5 w-3.5" />
                {shop.rating} ({shop.reviews})
              </dd>
            </div>
            <div className="rounded-xl bg-neutral-100 px-3 py-2">
              <dt className="text-[0.7rem] text-neutral-500">{t("hours")}</dt>
              <dd className="flex items-center gap-1 font-bold text-wash-500">
                <Icon name="Clock" className="h-3.5 w-3.5" />
                {shop.wait}
              </dd>
            </div>
          </dl>
        ) : null}

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mx-auto mt-3 flex items-center gap-1 bg-transparent p-0 font-black text-wash-500"
        >
          {t("showMore")}
          <Icon name="ChevronDown" className={cx("h-4 w-4 transition", expanded && "rotate-180")} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-black/10 px-5 py-4">
        <div>
          <strong className="block text-2xl font-black leading-none">
            {shop.starting} {t("tokens")}
          </strong>
          <span className="text-xs text-neutral-500">{t("startingAt")}</span>
        </div>
        <Button onClick={() => onBook?.(shop.id)} className="px-8">
          {t("bookNow")}
        </Button>
      </div>
    </article>
  );
}
