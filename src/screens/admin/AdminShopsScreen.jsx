"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, Check, Eye, RotateCcw, Store } from "lucide-react";
import { useAdminShops } from "../../lib/admin/useAdminShops.js";
import { ShopStatusBadge } from "../../components/owner/ShopStatusBadge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { cx } from "../../lib/cx.js";
import { formatVnd } from "../owner/format.js";

const FILTERS = [
  ["all", "All", undefined],
  ["pending", "Pending", "pending"],
  ["approved", "Approved", "approved"],
  ["suspended", "Suspended", "suspended"],
  ["draft", "Drafts", "draft"]
];

// Full shop directory for ongoing moderation: filter by status and take any
// admin-allowed action (approve / send back / suspend / reinstate).
export function AdminShopsScreen() {
  const [filter, setFilter] = useState("all");
  const status = FILTERS.find(([key]) => key === filter)?.[2];
  const { shops, loading, approve, sendBack, suspend, reinstate } = useAdminShops(status);
  const [busyId, setBusyId] = useState(null);

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
              Send back
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

      <div className="mt-5 flex flex-wrap gap-2">
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

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading…</p>
      ) : shops.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-12 text-center">
          <Store className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">No shops here</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {shops.map((shop) => {
            const busy = busyId === shop.id;
            return (
              <li key={shop.id} className="rounded-2xl border border-black/5 bg-white p-4">
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
                    </div>
                    <p className="mt-0.5 truncate text-sm text-neutral-500">
                      {shop.address || shop.district || "No address provided"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      From {formatVnd(shop.starting_price)} · {shop.serviceIds?.length ?? 0} services
                      {shop.owner?.email ? ` · ${shop.owner.email}` : ""}
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
