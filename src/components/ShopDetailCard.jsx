"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { images } from "../assets.js";
import { services as serviceCatalog } from "../data/catalog.js";
import { formatVnd } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { createClient } from "../lib/supabase/client.js";
import { openConversation } from "../lib/data/api.js";
import { computeHoursModel } from "../lib/hours.js";
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

// One circular icon + label in the action row under the photo (navigate / message
// / share / save). Renders an <a> for tel: links and a <button> otherwise.
function QuickAction({ icon, label, onClick, href, primary = false, active }) {
  const body = (
    <>
      <span
        className={cx(
          "grid h-12 w-12 place-items-center rounded-full transition",
          primary
            ? "bg-wash-500 text-white group-hover:bg-wash-600"
            : "bg-wash-50 text-wash-600 group-hover:bg-wash-100"
        )}
      >
        <Icon name={icon} className={cx("h-5 w-5", active && "fill-current")} />
      </span>
      <span className="text-[0.72rem] font-bold leading-tight text-neutral-600">{label}</span>
    </>
  );
  const className = "group flex flex-1 flex-col items-center gap-1.5 text-center";
  return href ? (
    <a href={href} aria-label={label} className={className}>
      {body}
    </a>
  ) : (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={typeof active === "boolean" ? active : undefined}
      className={className}
    >
      {body}
    </button>
  );
}

// A readable info row (address / price). When `copyText` is given the whole row
// becomes a button that copies it, flashing a green "Copied" confirmation (and
// announcing it to screen readers). Rows without `copyText` are plain text.
function DetailRow({ icon, children, copyText, t, isMobile }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard?.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const inner = (
    <>
      <Icon name={icon} className="mt-0.5 h-[18px] w-[18px] shrink-0 text-neutral-400" />
      <span className="min-w-0 flex-1 text-sm text-neutral-700">{children}</span>
      {copyText ? (
        <Icon
          name={copied ? "Check" : "Copy"}
          className={cx(
            "-my-0.5 h-4 w-4 shrink-0 transition",
            copied
              ? "text-ink"
              : cx("text-neutral-400", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100")
          )}
        />
      ) : null}
    </>
  );

  if (!copyText) {
    return <div className="flex items-start gap-3 rounded-xl px-2 py-2">{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? t("copied") : `${t("copy")}: ${copyText}`}
      className="group flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-neutral-50"
    >
      {inner}
      {/* Announce the copy to assistive tech without disturbing the visible layout. */}
      <span aria-live="polite" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </button>
  );
}

// The expandable opening-hours row: collapsed it shows the current state and the
// nearest transition ("Open · Closes 22:00" / "Closed · Opens Mon 08:00");
// expanded it lists the whole week. Falls back to the raw `hours` string when no
// structured hours are available.
function HoursRow({ shop, model, t }) {
  const [expanded, setExpanded] = useState(false);

  if (!model?.known) {
    return (
      <div className="flex items-start gap-3 rounded-xl px-2 py-2">
        <Icon name="Clock" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-neutral-400" />
        <span className="min-w-0 flex-1 text-sm">
          <span className={cx("font-bold", shop.open ? "text-emerald-600" : "text-rose-600")}>
            {shop.open ? t("open") : t("closed")}
          </span>
          <span className="text-neutral-500"> · {shop.hours ?? t("hours")}</span>
        </span>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-label={t("openingHours")}
        className="group flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-neutral-50"
      >
        <Icon name="Clock" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-neutral-400" />
        <span className="min-w-0 flex-1 text-sm">
          <span className={cx("font-bold", model.isOpen ? "text-emerald-600" : "text-rose-600")}>
            {model.isOpen ? t("open") : t("closed")}
          </span>
          {model.detail ? <span className="text-neutral-500"> · {model.detail}</span> : null}
        </span>
        <Icon
          name="ChevronDown"
          className={cx("mt-0.5 h-4 w-4 shrink-0 text-neutral-400 transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded ? (
        <dl className="grid gap-1.5 px-2 pb-2 pl-9 pt-1 text-sm">
          {model.week.map((day) => (
            <div key={day.idx} className="flex items-center justify-between gap-4">
              <dt className={cx(day.isToday ? "font-bold text-ink" : "text-neutral-500")}>{day.label}</dt>
              <dd className={cx(day.isToday && "font-bold", day.closed ? "text-rose-500" : "text-neutral-700")}>
                {day.text}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
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
  const [copied, setCopied] = useState(false);
  // One timestamp per card open (the card is keyed by shop.id, so it remounts on
  // selection) — drives the "open now / closes at" computation. The card only
  // mounts on user selection (client-side), so there's no SSR/hydration concern.
  const [now] = useState(() => new Date());
  const hoursModel = useMemo(() => (shop ? computeHoursModel(shop, now, t) : null), [shop, now, t]);
  if (!shop) return null;

  const isMobile = variant === "mobile";
  // Imported, info-only listing (business hasn't partnered with Washgo yet): no
  // booking / payment, just contact details. See migration 0020.
  const isDirectory = shop.listingType === "directory";
  const isFav = (state.favorites ?? []).includes(shop.id);
  const addressText = shop.district ? `${shop.district} · ${shop.address}` : shop.address;
  // Open/closed for the header badge — the schedule-derived state when we can parse
  // hours, otherwise the shop's stored flag. Kept in sync with the hours row below.
  const isOpen = hoursModel?.known ? hoursModel.isOpen : shop.open;

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

  // "Own this business?" — go to the verification form where the owner submits
  // services, hours and a location photo for admin review (see ClaimListingScreen).
  const onClaim = () => {
    if (requireAuth) {
      router.push("/login");
      return;
    }
    router.push(`/claim/${shop.id}`);
  };

  const onToggleFav = () => {
    if (requireAuth) {
      router.push("/login");
      return;
    }
    toggleFavorite(shop.id);
  };

  // Hand off to the device's maps app for turn-by-turn directions. Prefer the
  // precise lat/lng pin; fall back to a text address query.
  const onDirections = () => {
    const dest =
      shop.lat != null && shop.lng != null
        ? `${shop.lat},${shop.lng}`
        : encodeURIComponent([shop.name, shop.address].filter(Boolean).join(", "));
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, "_blank", "noopener,noreferrer");
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
    } catch (err) {
      // Only stop on a genuine user-cancel; any other failure (permission,
      // unsupported payload) falls through to the clipboard copy below.
      if (err?.name === "AbortError") return;
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
        {/* Header: name + rating/price summary (close/back lives top-right). */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-black leading-tight">{shop.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
              <span className="inline-flex items-center gap-1 font-bold text-ink">
                <Icon name="Star" className="h-4 w-4 fill-amber-400 text-amber-400" />
                {shop.rating}
              </span>
              <span className="text-neutral-500">({shop.reviews})</span>
              {isDirectory ? null : (
                <>
                  <span className="text-neutral-300">·</span>
                  <span className="font-semibold text-neutral-600">
                    {t("from")} {formatVnd(shop.starting)}
                  </span>
                </>
              )}
            </p>
            {/* Open/closed (state only) + distance, directly under the rating. */}
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm">
              <span className={cx("font-bold", isOpen ? "text-emerald-600" : "text-rose-600")}>
                {isOpen ? t("open") : t("closed")}
              </span>
              {shop.distance ? (
                <>
                  <span className="text-neutral-300">·</span>
                  <span className="text-neutral-500">{shop.distance}</span>
                </>
              ) : null}
            </p>
          </div>
          <IconButton
            label={t("close")}
            onClick={isMobile ? onBack : onClose}
            className="h-9 w-9 bg-neutral-100"
          >
            <Icon name={isMobile ? "ArrowLeft" : "X"} className="h-5 w-5" />
          </IconButton>
        </div>

        {/* aria-live so the clipboard fallback is announced to screen readers */}
        <p aria-live="polite" className={cx("mt-1 text-xs font-bold text-wash-500", !copied && "sr-only")}>
          {copied ? t("linkCopied") : ""}
        </p>

        {/* Owner-uploaded gallery: a scroll-snap row when there's more than one
            photo, otherwise the single cover. Falls back to the hero image. */}
        {shop.imageUrls?.length > 1 ? (
          <div className="mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-xl">
            {shop.imageUrls.map((url, i) => (
              <img
                key={`${url}-${i}`}
                src={url}
                alt={`${shop.name} ${i + 1}`}
                className={cx(
                  "w-full shrink-0 snap-center rounded-xl object-cover object-center",
                  isMobile ? "h-48" : "h-44"
                )}
              />
            ))}
          </div>
        ) : (
          <img
            src={shop.imageUrl || images.hero}
            alt={shop.name}
            className={cx(
              "mt-4 w-full rounded-xl object-cover",
              shop.imageUrl ? "object-center" : "object-[58%_center]",
              isMobile ? "h-48" : "h-44"
            )}
          />
        )}

        {/* Quick actions (navigate / message / call / share / save). */}
        <div className="mt-4 flex items-start justify-around gap-1">
          <QuickAction icon="LocateFixed" label={t("directions")} onClick={onDirections} primary />
          {mode === "backend" && shop.ownerId ? (
            <QuickAction icon="MessageCircle" label={t("message")} onClick={onMessageShop} />
          ) : null}
          {shop.phone ? (
            <QuickAction
              icon="Phone"
              label={t("callShop")}
              href={`tel:${shop.phone.replace(/\s+/g, "")}`}
            />
          ) : null}
          <QuickAction icon="Share2" label={t("share")} onClick={onShare} />
          <QuickAction icon="Heart" label={isFav ? t("saved") : t("save")} onClick={onToggleFav} active={isFav} />
        </div>

        {/* Readable details: address, starting price, opening hours. */}
        <div className="mt-4 grid gap-0.5 border-t border-black/5 pt-3">
          <DetailRow icon="MapPin" copyText={addressText} t={t} isMobile={isMobile}>
            {addressText}
          </DetailRow>
          {isDirectory ? null : (
            <DetailRow icon="Coins" t={t} isMobile={isMobile}>
              <span className="text-neutral-500">{t("from")} </span>
              <span className="font-semibold text-ink">{formatVnd(shop.starting)}</span>
            </DetailRow>
          )}
          <HoursRow shop={shop} model={hoursModel} t={t} />
        </div>

        {/* Promo video info card — paid feature, only present when ACTIVE. */}
        {shop.promoVideoUrl ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-black/10 bg-neutral-50">
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-black text-wash-600">
              <Icon name="Play" className="h-4 w-4" />
              {t("watchPromo")}
            </div>
            <video
              src={shop.promoVideoUrl}
              controls
              playsInline
              className={cx("w-full object-cover", isMobile ? "h-48" : "h-44")}
            />
          </div>
        ) : null}

        {isDirectory ? (
          shop.notes ? (
            <>
              <h2 className="mt-4 font-display text-sm font-black text-neutral-600">{t("aboutShop")}</h2>
              <p className="mt-2 text-sm text-neutral-600">{shop.notes}</p>
            </>
          ) : null
        ) : (
          <>
            {shop.notes ? (
              <>
                <h2 className="mt-4 font-display text-sm font-black text-neutral-600">{t("aboutShop")}</h2>
                <p className="mt-2 text-sm text-neutral-600">{shop.notes}</p>
              </>
            ) : null}
            <h2 className="mt-4 font-display text-sm font-black text-neutral-600">{t("serviceIncluded")}</h2>
            <div className="mt-2">
              <ServiceChips shop={shop} t={t} />
            </div>
          </>
        )}
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
            <strong className="block text-2xl font-black leading-none">{formatVnd(shop.starting)}</strong>
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
