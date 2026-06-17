"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ClipboardCheck, Eye, Store, Undo2 } from "lucide-react";
import { useAdminShops } from "../../lib/admin/useAdminShops.js";
import { ShopStatusBadge } from "../../components/owner/ShopStatusBadge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { formatVnd } from "../owner/format.js";

// The admin's primary surface: shops owners have submitted for review
// (status='pending'). Approve publishes them to customers; "Send back" returns
// them to the owner as a draft to fix and resubmit.
export function AdminQueueScreen() {
  const { shops, loading, approve, sendBack } = useAdminShops("pending");
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

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <header>
        <h1 className="font-display text-2xl font-black">Approval queue</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Review the car wash information owners submitted and publish or send it back.
        </p>
      </header>

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Loading…</p>
      ) : shops.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-14 text-center">
          <ClipboardCheck className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">Nothing to review</p>
          <p className="mt-1 text-sm text-neutral-500">
            New submissions from shop owners will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {shops.map((shop) => {
            const busy = busyId === shop.id;
            return (
              <li key={shop.id} className="rounded-2xl border border-black/5 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-100">
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

                <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3">
                  <Link href={`/admin/shops/${shop.id}`}>
                    <Button variant="subtle" className="min-h-9 px-3 text-sm">
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      Review details
                    </Button>
                  </Link>
                  <Button
                    className="min-h-9 px-3 text-sm"
                    disabled={busy}
                    onClick={() => act(shop.id, () => approve(shop.id))}
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    className="ml-auto min-h-9 px-3 text-sm"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Reject this shop and send it back to the owner as a draft?")) {
                        act(shop.id, () => sendBack(shop.id));
                      }
                    }}
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    Reject
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
