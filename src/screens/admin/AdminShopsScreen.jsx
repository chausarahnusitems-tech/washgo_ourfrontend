"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Ban, Check, Eye, MapPin, RotateCcw, Search, Star, Store } from "lucide-react";
import { userLocation } from "../../data/catalog.js";
import { useAdminShops } from "../../lib/admin/useAdminShops.js";
import { ShopStatusBadge } from "../../components/owner/ShopStatusBadge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { InteractiveMap } from "../../components/map/InteractiveMapDynamic.jsx";
import { cx } from "../../lib/cx.js";
import { foldAccents } from "../../lib/booking.js";
import { formatVnd } from "../owner/format.js";

const FILTERS = [
  ["all", "All", undefined],
  ["pending", "Pending", "pending"],
  ["approved", "Approved", "approved"],
  ["suspended", "Suspended", "suspended"],
  ["draft", "Drafts", "draft"]
];

const TYPE_FILTERS = [
  ["all", "All types"],
  ["partner", "Partners"],
  ["directory", "Directory"]
];

// Full shop directory for ongoing moderation: filter by status and take any
// admin-allowed action (approve / send back / suspend / reinstate).
export function AdminShopsScreen() {
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const status = FILTERS.find(([key]) => key === filter)?.[2];
  const { shops, loading, approve, sendBack, suspend, reinstate } = useAdminShops(status);
  const [busyId, setBusyId] = useState(null);
  // Overview map <-> list cross-highlight: clicking a pin selects + scrolls to
  // the matching row. Refs are keyed by shop id for scrollIntoView.
  const [selectedId, setSelectedId] = useState(null);
  const rowRefs = useRef({});

  const needle = foldAccents(search.trim());
  const visibleShops = shops.filter((s) => {
    if (!(typeFilter === "all" || (s.listing_type ?? "partner") === typeFilter)) return false;
    if (!needle) return true;
    return foldAccents(`${s.name ?? ""} ${s.address ?? ""} ${s.district ?? ""}`).includes(needle);
  });

  // Shape the visible, geocoded shops for InteractiveMap; rows without a pin are
  // dropped so the map only plots locatable shops.
  const mapShops = visibleShops
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      starting: s.starting_price,
      listingType: s.listing_type
    }));

  function onSelectShop(id) {
    setSelectedId(id);
    rowRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function act(id, fn) {
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      console.error("[washgo] admin action failed", err);
      window.alert(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  function actionsFor(shop, busy) {
    switch (shop.status) {
      case "pending":
        return (
          <>
            <Button className="min-h-9 px-3 text-sm" disabled={busy} onClick={() => act(shop.id, () => approve(shop.id))}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Approve
            </Button>
            <Button variant="secondary" className="min-h-9 px-3 text-sm" disabled={busy} onClick={() => act(shop.id, () => sendBack(shop.id))}>
              Reject
            </Button>
          </>
        );
      case "approved":
        return (
          <Button
            variant="ghost"
            className="min-h-9 px-3 text-sm text-red-600 hover:bg-red-50"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Suspend this shop? It will be hidden from customers.")) {
                act(shop.id, () => suspend(shop.id));
              }
            }}
          >
            <Ban className="h-4 w-4" aria-hidden="true" />
            Suspend
          </Button>
        );
      case "suspended":
        return (
          <Button className="min-h-9 px-3 text-sm" disabled={busy} onClick={() => act(shop.id, () => reinstate(shop.id))}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reinstate
          </Button>
        );
      default:
        return null; // drafts are the owner's WIP — no admin action
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <header>
        <h1 className="font-display text-2xl font-black">All shops</h1>
        <p className="mt-1 text-sm text-neutral-500">Moderate every car wash on the platform.</p>
      </header>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search shops by name, address or district"
          className="min-h-11 w-full rounded-full border border-black/10 bg-white pl-9 pr-4 text-sm outline-none focus:border-wash-500"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={cx(
              "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
              filter === key
                ? "border-ink bg-ink text-white"
                : "border-black/10 bg-white text-ink hover:bg-neutral-50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {TYPE_FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTypeFilter(key)}
            aria-pressed={typeFilter === key}
            className={cx(
              "rounded-full border px-3 py-1 text-xs font-semibold transition",
              typeFilter === key
                ? "border-wash-500 bg-wash-50 text-wash-600"
                : "border-black/10 bg-white text-neutral-500 hover:bg-neutral-50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mapShops.length > 0 && (
        <section className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-neutral-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Map
          </p>
          <InteractiveMap
            shops={mapShops}
            selectedId={selectedId}
            onSelectShop={onSelectShop}
            userLocation={userLocation}
            className="h-64 w-full"
            rounded="rounded-2xl"
          />
        </section>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading…</p>
      ) : visibleShops.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-12 text-center">
          <Store className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">No shops here</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {visibleShops.map((shop) => {
            const busy = busyId === shop.id;
            const isDirectory = (shop.listing_type ?? "partner") === "directory";
            const hasReviews = (shop.reviews_count ?? 0) > 0;
            const selected = selectedId === shop.id;
            return (
              <li
                key={shop.id}
                ref={(el) => {
                  rowRefs.current[shop.id] = el;
                }}
                className={cx(
                  "rounded-2xl border bg-white p-4 transition",
                  selected ? "border-wash-500 ring-2 ring-wash-500/30" : "border-black/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-100">
                    {shop.image_url ? (
                      <img src={shop.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-6 w-6 text-neutral-400" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-bold text-ink">
                        {shop.name || "Untitled shop"}
                      </h2>
                      <ShopStatusBadge status={shop.status} />
                      {isDirectory ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wide text-amber-700">
                          Directory
                        </span>
                      ) : null}
                      <span
                        className={cx(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                          hasReviews ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-400"
                        )}
                      >
                        <Star
                          className={cx(
                            "h-3.5 w-3.5",
                            hasReviews ? "fill-amber-400 text-amber-400" : "text-neutral-300"
                          )}
                          aria-hidden="true"
                        />
                        {hasReviews ? `${shop.rating} (${shop.reviews_count})` : "No reviews"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-neutral-500">
                      {shop.address || shop.district || "No address provided"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      {isDirectory
                        ? "Info-only listing · not a Washgo partner"
                        : `From ${formatVnd(shop.starting_price)} · ${shop.serviceIds?.length ?? 0} services${
                            shop.owner?.email ? ` · ${shop.owner.email}` : ""
                          }`}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
                  <Link href={`/admin/shops/${shop.id}`}>
                    <Button variant="subtle" className="min-h-9 px-3 text-sm">
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      View
                    </Button>
                  </Link>
                  <div className="ml-auto flex flex-wrap gap-2">{actionsFor(shop, busy)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
