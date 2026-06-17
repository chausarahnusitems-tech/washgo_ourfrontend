"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Send, Store, Trash2, Undo2 } from "lucide-react";
import { useOwnerShops } from "../../lib/owner/useOwnerShops.js";
import { ShopStatusBadge } from "../../components/owner/ShopStatusBadge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { formatVnd } from "./format.js";

export function OwnerShopsScreen() {
  const { shops, loading, submit, remove } = useOwnerShops();
  const [busyId, setBusyId] = useState(null);

  async function withBusy(id, fn) {
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      console.error("[washgo] owner shop action failed", err);
      window.alert(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-black">My shops</h1>
        <Link href="/owner/shops/new">
          <Button>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New shop
          </Button>
        </Link>
      </header>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading…</p>
      ) : shops.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-12 text-center">
          <Store className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">No shops yet</p>
          <Link href="/owner/shops/new" className="mt-4">
            <Button>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create a shop
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {shops.map((shop) => {
            const busy = busyId === shop.id;
            const isApproved = shop.status === "approved";
            const canDelete = !isApproved;
            return (
              <li
                key={shop.id}
                className="rounded-2xl border border-black/5 bg-white p-4"
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
                    </div>
                    <p className="mt-0.5 truncate text-sm text-neutral-500">
                      {shop.address || "No address yet"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      From {formatVnd(shop.starting_price)} · {shop.serviceIds?.length ?? 0} services
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3">
                  <Link href={`/owner/shops/${shop.id}`}>
                    <Button variant="subtle" className="min-h-9 px-3 text-sm">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                  </Link>

                  {shop.status === "draft" && (
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3 text-sm"
                      disabled={busy}
                      onClick={() => withBusy(shop.id, () => submit(shop.id, "pending"))}
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Submit for approval
                    </Button>
                  )}

                  {shop.status === "pending" && (
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3 text-sm"
                      disabled={busy}
                      onClick={() => withBusy(shop.id, () => submit(shop.id, "draft"))}
                    >
                      <Undo2 className="h-4 w-4" aria-hidden="true" />
                      Withdraw to draft
                    </Button>
                  )}

                  {canDelete && (
                    <Button
                      variant="ghost"
                      className="ml-auto min-h-9 px-3 text-sm text-red-600 hover:bg-red-50"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete "${shop.name || "this shop"}"? This cannot be undone.`)) {
                          withBusy(shop.id, () => remove(shop.id));
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
