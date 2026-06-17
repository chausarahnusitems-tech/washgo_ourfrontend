"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { images } from "../assets.js";
import { services as serviceCatalog } from "../data/catalog.js";
import { formatVnd } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { createClient } from "../lib/supabase/client.js";
import { openConversation } from "../lib/data/api.js";
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
  const router = useRouter();
  const { state, toggleFavorite, requireAuth, mode } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!shop) return null;

  // Open (or resume) a chat thread with this shop's owner.
  const onMessageShop = async () => {
    if (requireAuth) {
      router.push("/login");
      return;
    }
    try {
      const supabase = createClient();
      const id = await openConversation(supabase, "shop", shop.id);
      router.push(`/chat?c=${id}`);
    } catch (err) {
      console.error("[washgo] open shop chat failed", err);
    }
  };

  // Imported, info-only listing (business hasn't partnered with Washgo yet): no
  // booking / payment, just contact details. See migration 0020.
  const isDirectory = shop.listingType === "directory";

  // "Own this business?" — go to the verification form where the owner submits
  // services, hours and a location photo for admin review (see ClaimListingScreen).
  const onClaim = () => {
    if (requireAuth) {
      router.push("/login");
      return;
    }
    router.push(`/claim/${shop.id}`);
  };

  const isMobile = variant === "mobile";
  const isFav = (state.favorites ?? []).includes(shop.id);

  const onToggleFav = () => {
    if (requireAuth) {
      router.push("/login");
      return;
    }
    toggleFavorite(shop.id);
  };

  // Share via the Web Share API where available, falling back to copying the
  // link to the clipboard (with a brief "Link copied" confirmation). No backend.
  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: shop.name, text: shop.address, url });
        return;
      }
    } catch {
      return; // user dismissed the share sheet
    }
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

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
            <IconButton label={t("share")} onClick={onShare} className="h-9 w-9 bg-neutral-100">
              <Icon name="Share2" className="h-5 w-5" />
            </IconButton>
            <IconButton
              label={isFav ? t("saved") : t("save")}
              aria-pressed={isFav}
              onClick={onToggleFav}
              className="h-9 w-9 bg-neutral-100"
            >
              <Icon name="Heart" className={cx("h-5 w-5", isFav && "fill-wash-500 text-wash-500")} />
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

        {/* aria-live so the clipboard fallback is announced to screen readers */}
        <p aria-live="polite" className={cx("text-xs font-bold text-wash-500", !copied && "sr-only")}>
          {copied ? t("linkCopied") : ""}
        </p>

        <p className="mt-1 text-sm text-neutral-600">
          <span
            className={cx(
              "mr-1 rounded px-1 text-[0.62rem] font-black text-white",
              shop.open ? "bg-emerald-500" : "bg-neutral-400"
            )}
          >
            {shop.open ? t("open") : t("closed")}
          </span>
          {shop.hours ?? t("hours")} <span className="text-neutral-400">·</span> {shop.distance}
        </p>
        <p className="mt-1 flex items-start gap-2 text-sm text-neutral-600">
          <Icon name="MapPin" className="mt-0.5 h-4 w-4 shrink-0" />
          {shop.district ? `${shop.district} · ${shop.address}` : shop.address}
        </p>

        {/* Hand off to the device's maps app for turn-by-turn directions. Prefer
            the precise lat/lng pin; fall back to a text address query. */}
        <button
          type="button"
          onClick={() => {
            const dest =
              shop.lat != null && shop.lng != null
                ? `${shop.lat},${shop.lng}`
                : encodeURIComponent([shop.name, shop.address].filter(Boolean).join(", "));
            window.open(
              `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
              "_blank",
              "noopener,noreferrer"
            );
          }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-wash-50 px-3 py-1.5 text-sm font-bold text-wash-600 transition hover:bg-wash-100"
        >
          <Icon name="LocateFixed" className="h-4 w-4" />
          {t("getDirections")}
        </button>

        {/* Directory listings aren't bookable, so the primary action is a direct
            phone call to the shop. Hidden when no number is on record. */}
        {isDirectory && shop.phone ? (
          <a
            href={`tel:${shop.phone.replace(/\s+/g, "")}`}
            className="mt-2 ml-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
          >
            <Icon name="Phone" className="h-4 w-4" />
            {t("callShop")}
          </a>
        ) : null}

        {mode === "backend" && shop.ownerId ? (
          <button
            type="button"
            onClick={onMessageShop}
            className="mt-2 ml-2 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-bold text-ink transition hover:bg-neutral-200"
          >
            <Icon name="MessageCircle" className="h-4 w-4" />
            {t("messageShop")}
          </button>
        ) : null}

        <img
          src={images.hero}
          alt={shop.name}
          className={cx(
            "mt-4 w-full rounded-xl object-cover object-[58%_center]",
            isMobile ? "h-48" : "h-44"
          )}
        />

        {isDirectory ? (
          shop.notes ? (
            <>
              <h2 className="mt-4 font-display text-sm font-black text-neutral-600">{t("aboutShop")}</h2>
              <p className="mt-2 text-sm text-neutral-600">{shop.notes}</p>
            </>
          ) : null
        ) : (
          <>
            <h2 className="mt-4 font-display text-sm font-black text-neutral-600">{t("serviceIncluded")}</h2>
            <div className="mt-2">
              <ServiceChips shop={shop} t={t} />
            </div>
            {shop.notes ? (
              <>
                <h2 className="mt-4 font-display text-sm font-black text-neutral-600">{t("aboutShop")}</h2>
                <p className="mt-2 text-sm text-neutral-600">{shop.notes}</p>
              </>
            ) : null}
          </>
        )}

        {expanded ? (
          <dl className={cx("mt-3 grid gap-2 text-sm", isDirectory ? "grid-cols-1" : "grid-cols-2")}>
            <div className="rounded-xl bg-neutral-100 px-3 py-2">
              <dt className="text-[0.7rem] text-neutral-500">{t("recommended")}</dt>
              <dd className="flex items-center gap-1 font-bold text-wash-500">
                <Icon name="Star" className="h-3.5 w-3.5" />
                {shop.rating} ({shop.reviews})
              </dd>
            </div>
            {/* Directory listings have no Washgo pricing — only show the rating. */}
            {isDirectory ? null : (
              <div className="rounded-xl bg-neutral-100 px-3 py-2">
                <dt className="text-[0.7rem] text-neutral-500">{t("startingAt")}</dt>
                <dd className="flex items-center gap-1 font-bold text-wash-500">
                  <Icon name="Star" className="h-3.5 w-3.5" />
                  {formatVnd(shop.starting)}
                </dd>
              </div>
            )}
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

      {isDirectory ? (
        <div className="border-t border-black/10 px-5 py-4">
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
            <Icon name="Info" className="mt-0.5 h-4 w-4 shrink-0" />
            {t("notOnWashgo")}
          </p>
          {mode === "backend" ? (
            <button
              type="button"
              onClick={onClaim}
              className="mt-2 bg-transparent p-0 text-xs font-bold text-wash-500 underline-offset-2 hover:underline"
            >
              {t("claimListing")}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 border-t border-black/10 px-5 py-4">
          <div>
            <strong className="block text-2xl font-black leading-none">
              {formatVnd(shop.starting)}
            </strong>
            <span className="text-xs text-neutral-500">{t("startingAt")}</span>
          </div>
          <Button onClick={() => onBook?.(shop.id)} className="px-8">
            {t("bookNow")}
          </Button>
        </div>
      )}
    </article>
  );
}
