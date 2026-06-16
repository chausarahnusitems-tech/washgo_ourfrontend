"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, Check, MapPin, RotateCcw, Store, Undo2 } from "lucide-react";
import { userLocation } from "../../data/catalog.js";
import { useApp } from "../../lib/AppContext.jsx";
import { useAdminShops } from "../../lib/admin/useAdminShops.js";
import { cx } from "../../lib/cx.js";
import { Button } from "../../components/ui/Button.jsx";
import { InteractiveMap } from "../../components/map/InteractiveMapDynamic.jsx";
import { ShopStatusBadge } from "../../components/owner/ShopStatusBadge.jsx";
import { formatVnd } from "../owner/format.js";

// Full read-only review of one shop's submitted information, with the
// moderation actions appropriate to its status. Admins moderate status only —
// they don't edit the owner's content here.
export function AdminShopReviewScreen({ shopId }) {
  const router = useRouter();
  const { catalog, t } = useApp();
  const { shops, loading, approve, sendBack, suspend, reinstate } = useAdminShops();
  const shop = shops.find((s) => s.id === shopId);
  const [busy, setBusy] = useState(false);

  if (loading && !shop) {
    return <CenterNote>Loading…</CenterNote>;
  }
  if (!shop) {
    return (
      <CenterNote>
        <p className="font-semibold text-ink">Shop not found</p>
        <Link href="/admin" className="mt-3 text-sm font-bold text-wash-500">
          Back to queue
        </Link>
      </CenterNote>
    );
  }

  async function act(fn, { back } = {}) {
    setBusy(true);
    try {
      await fn();
      if (back) router.push("/admin");
    } catch (err) {
      console.error("[washgo] admin review action failed", err);
      window.alert(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const services = (shop.serviceIds ?? [])
    .map((id) => catalog.services?.find((s) => s.id === id))
    .filter(Boolean);
  const hasPoint = shop.lat != null && shop.lng != null;
  const position = shop.image_position || "object-center";

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Approval queue
      </Link>

      <header className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-black">{shop.name || "Untitled shop"}</h1>
        <ShopStatusBadge status={shop.status} />
      </header>
      {shop.owner && (
        <p className="mt-1 text-sm text-neutral-500">
          Submitted by {shop.owner.full_name || shop.owner.email}
          {shop.owner.full_name && shop.owner.email ? ` · ${shop.owner.email}` : ""}
        </p>
      )}

      {/* Cover photo */}
      <div className="mt-5 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-neutral-100">
        {shop.image_url ? (
          <img src={shop.image_url} alt="Shop cover" className={cx("h-full w-full object-cover", position)} />
        ) : (
          <div className="grid h-full w-full place-items-center text-neutral-300">
            <Store className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Submitted details */}
      <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="District" value={shop.district} />
        <Field label="Phone" value={shop.phone} />
        <Field label="Address" value={shop.address} className="sm:col-span-2" />
        <Field label="Starting price" value={formatVnd(shop.starting_price)} />
        <Field label="Wait time" value={shop.wait_minutes != null ? `${shop.wait_minutes} min` : null} />
        <Field label="Hours" value={shop.hours} />
        <Field label="Open for bookings" value={shop.is_open ? "Yes" : "No"} />
        <Field label="Promo badge" value={shop.promo ? "Shown" : "Hidden"} />
      </dl>

      {/* Services */}
      <section className="mt-6">
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-neutral-500">Services</p>
        {services.length === 0 ? (
          <p className="text-sm text-neutral-400">No services selected.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {services.map((s) => (
              <li key={s.id} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-ink">
                {t(s.id)} · {formatVnd(s.price)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Location */}
      <section className="mt-6">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-neutral-500">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          Location
        </p>
        {hasPoint ? (
          <InteractiveMap
            shops={[{ id: shop.id, lat: shop.lat, lng: shop.lng }]}
            selectedId={shop.id}
            userLocation={userLocation}
            className="h-64 w-full"
            rounded="rounded-2xl"
          />
        ) : (
          <p className="text-sm text-neutral-400">No location pin provided.</p>
        )}
      </section>

      {/* Moderation actions */}
      <div className="sticky bottom-0 mt-8 flex flex-wrap gap-2 border-t border-black/10 bg-mist/95 py-4 backdrop-blur">
        {shop.status === "pending" && (
          <>
            <Button disabled={busy} onClick={() => act(() => approve(shop.id), { back: true })}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Approve & publish
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Reject this shop and send it back to the owner as a draft?")) {
                  act(() => sendBack(shop.id), { back: true });
                }
              }}
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              Reject
            </Button>
          </>
        )}
        {shop.status === "approved" && (
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Suspend this shop? It will be hidden from customers.")) {
                act(() => suspend(shop.id));
              }
            }}
          >
            <Ban className="h-4 w-4" aria-hidden="true" />
            Suspend
          </Button>
        )}
        {shop.status === "suspended" && (
          <Button disabled={busy} onClick={() => act(() => reinstate(shop.id))}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reinstate
          </Button>
        )}
        {shop.status === "draft" && (
          <p className="text-sm text-neutral-500">
            This shop is still a draft — the owner hasn&apos;t submitted it for review yet.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, className }) {
  return (
    <div className={className}>
      <dt className="text-xs font-black uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value || <span className="text-neutral-400">—</span>}</dd>
    </div>
  );
}

function CenterNote({ children }) {
  return (
    <div className="grid h-full place-items-center px-6 py-16 text-center text-sm text-neutral-500">
      <div>{children}</div>
    </div>
  );
}
