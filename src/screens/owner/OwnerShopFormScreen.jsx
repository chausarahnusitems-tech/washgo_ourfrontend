"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Send, Undo2 } from "lucide-react";
import { userLocation } from "../../data/catalog.js";
import { useApp } from "../../lib/AppContext.jsx";
import { useOwnerShops } from "../../lib/owner/useOwnerShops.js";
import { cx } from "../../lib/cx.js";
import { Button } from "../../components/ui/Button.jsx";
import { InteractiveMap } from "../../components/map/InteractiveMapDynamic.jsx";
import { ShopStatusBadge } from "../../components/owner/ShopStatusBadge.jsx";
import { OwnerShopServices } from "./OwnerShopServices.jsx";
import { OwnerShopPhotos } from "./OwnerShopPhotos.jsx";
import { OwnerBookings } from "./OwnerBookings.jsx";

const inputClass =
  "min-h-11 w-full rounded-2xl border border-black/10 px-4 text-sm outline-none focus:border-wash-500";
const labelClass = "text-xs font-black uppercase tracking-wide text-neutral-500";

const TABS = ["details", "photos", "services", "bookings"];
const TAB_LABELS = {
  details: "Details",
  photos: "Photos",
  services: "Services",
  bookings: "Bookings"
};

// Shared create + edit screen. Without a shopId it's a create form (Details
// only); with one it's a tabbed editor.
export function OwnerShopFormScreen({ shopId }) {
  const router = useRouter();
  const owner = useOwnerShops();
  const isEdit = Boolean(shopId);
  const shop = isEdit ? owner.shops.find((s) => s.id === shopId) : null;

  const [tab, setTab] = useState("details");

  if (isEdit && owner.loading && !shop) {
    return <CenterNote>Loading…</CenterNote>;
  }
  if (isEdit && !shop) {
    return (
      <CenterNote>
        <p className="font-semibold text-ink">Shop not found</p>
        <Link href="/owner/shops" className="mt-3 text-sm font-bold text-wash-500">
          Back to my shops
        </Link>
      </CenterNote>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-10">
      <Link
        href="/owner/shops"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        My shops
      </Link>

      <header className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-black">
          {isEdit ? shop.name || "Untitled shop" : "New shop"}
        </h1>
        {isEdit && <ShopStatusBadge status={shop.status} />}
      </header>

      {isEdit && (
        <>
          <StatusActions shop={shop} submit={owner.submit} />
          <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-black/10">
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={tab === key ? "page" : undefined}
                className={cx(
                  "shrink-0 border-b-2 px-4 py-2.5 text-sm font-bold transition",
                  tab === key
                    ? "border-wash-500 text-wash-600"
                    : "border-transparent text-neutral-500 hover:text-ink"
                )}
              >
                {TAB_LABELS[key]}
              </button>
            ))}
          </nav>
        </>
      )}

      <div className="mt-6">
        {(!isEdit || tab === "details") && (
          <ShopDetailsForm
            shop={shop}
            submitLabel={isEdit ? "Save changes" : "Create shop"}
            onSave={async (payload) => {
              if (isEdit) {
                await owner.update(shop.id, payload);
              } else {
                const created = await owner.create(payload);
                router.push(`/owner/shops/${created.id}`);
              }
            }}
          />
        )}
        {isEdit && tab === "photos" && (
          <OwnerShopPhotos shop={shop} uploadPhoto={owner.uploadPhoto} update={owner.update} />
        )}
        {isEdit && tab === "services" && (
          <OwnerShopServices shop={shop} saveServices={owner.saveServices} />
        )}
        {isEdit && tab === "bookings" && <OwnerBookings shopId={shop.id} />}
      </div>
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

// Draft → pending (submit) / pending → draft (withdraw) controls. Approved and
// suspended shops have no owner-driven transition.
function StatusActions({ shop, submit }) {
  const [busy, setBusy] = useState(false);

  async function move(status) {
    setBusy(true);
    try {
      await submit(shop.id, status);
    } catch (err) {
      console.error("[washgo] status change failed", err);
      window.alert(err?.message || "Could not change status.");
    } finally {
      setBusy(false);
    }
  }

  if (shop.status === "draft") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3">
        <p className="flex-1 text-sm text-amber-800">
          This shop is a draft and isn&apos;t visible to customers yet.
        </p>
        <Button className="min-h-9 px-3 text-sm" disabled={busy} onClick={() => move("pending")}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Submit
        </Button>
      </div>
    );
  }
  if (shop.status === "pending") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3">
        <p className="flex-1 text-sm text-amber-800">
          Submitted for review. An admin will approve it before it goes live.
        </p>
        <Button
          variant="secondary"
          className="min-h-9 px-3 text-sm"
          disabled={busy}
          onClick={() => move("draft")}
        >
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          Withdraw
        </Button>
      </div>
    );
  }
  if (shop.status === "approved") {
    return (
      <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        This shop is live and visible to customers.
      </p>
    );
  }
  return (
    <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
      This shop has been suspended. Contact support for details.
    </p>
  );
}

function ShopDetailsForm({ shop, onSave, submitLabel }) {
  const [form, setForm] = useState(() => ({
    name: shop?.name ?? "",
    district: shop?.district ?? "",
    address: shop?.address ?? "",
    phone: shop?.phone ?? "",
    starting_price: shop?.starting_price ?? "",
    wait_minutes: shop?.wait_minutes ?? "",
    hours: shop?.hours ?? "",
    is_open: shop?.is_open ?? true,
    promo: shop?.promo ?? false,
    lat: shop?.lat ?? null,
    lng: shop?.lng ?? null
  }));
  const [status, setStatus] = useState(null); // null | "saving" | "saved" | error

  const set = (key) => (event) => {
    const value =
      event?.target?.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus(null);
  };

  const pickLocation = (lat, lng) => {
    setForm((prev) => ({
      ...prev,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6))
    }));
    setStatus(null);
  };

  const hasPoint = form.lat != null && form.lng != null;
  // A single pin for the picked location, fed into the shared map's marker layer.
  const pins = useMemo(
    () => (hasPoint ? [{ id: "picked", lat: form.lat, lng: form.lng }] : []),
    [hasPoint, form.lat, form.lng]
  );

  async function onSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      setStatus("Please enter a shop name.");
      return;
    }
    setStatus("saving");
    try {
      await onSave({
        name: form.name.trim(),
        district: form.district.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        starting_price: form.starting_price === "" ? 0 : Math.round(Number(form.starting_price)),
        wait_minutes: form.wait_minutes === "" ? null : Math.round(Number(form.wait_minutes)),
        hours: form.hours.trim() || null,
        is_open: form.is_open,
        promo: form.promo,
        lat: form.lat,
        lng: form.lng
      });
      setStatus("saved");
    } catch (err) {
      console.error("[washgo] save shop failed", err);
      setStatus(err?.message || "Could not save. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-1.5">
        <label className={labelClass} htmlFor="shop-name">Shop name</label>
        <input
          id="shop-name"
          required
          value={form.name}
          onChange={set("name")}
          placeholder="Lotus Detail Studio"
          className={inputClass}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="shop-district">District</label>
          <input
            id="shop-district"
            value={form.district}
            onChange={set("district")}
            placeholder="District 7"
            className={inputClass}
          />
        </div>
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="shop-phone">Phone</label>
          <input
            id="shop-phone"
            value={form.phone}
            onChange={set("phone")}
            placeholder="+84 ..."
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label className={labelClass} htmlFor="shop-address">Address</label>
        <input
          id="shop-address"
          value={form.address}
          onChange={set("address")}
          placeholder="21 Nguyen Thi Thap, District 7, Ho Chi Minh City"
          className={inputClass}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="shop-price">Starting price (₫)</label>
          <input
            id="shop-price"
            type="number"
            min="0"
            value={form.starting_price}
            onChange={set("starting_price")}
            placeholder="120000"
            className={inputClass}
          />
        </div>
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="shop-wait">Wait (min)</label>
          <input
            id="shop-wait"
            type="number"
            min="0"
            value={form.wait_minutes}
            onChange={set("wait_minutes")}
            placeholder="12"
            className={inputClass}
          />
        </div>
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="shop-hours">Hours</label>
          <input
            id="shop-hours"
            value={form.hours}
            onChange={set("hours")}
            placeholder="8:00 – 20:00"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input type="checkbox" checked={form.is_open} onChange={set("is_open")} className="h-4 w-4" />
          Open for bookings
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input type="checkbox" checked={form.promo} onChange={set("promo")} className="h-4 w-4" />
          Show promo badge
        </label>
      </div>

      <div className="grid gap-2">
        <span className={labelClass}>Location</span>
        <p className="flex items-center gap-1.5 text-xs text-neutral-500">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {hasPoint
            ? `${form.lat}, ${form.lng} — tap the map to adjust`
            : "Tap the map to drop a pin at your shop."}
        </p>
        <InteractiveMap
          shops={pins}
          selectedId={hasPoint ? "picked" : null}
          onPick={pickLocation}
          userLocation={userLocation}
          className="h-72 w-full"
          rounded="rounded-2xl"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : submitLabel}
        </Button>
        {status === "saved" && (
          <span className="text-sm font-semibold text-emerald-600">Saved</span>
        )}
        {status && !["saving", "saved"].includes(status) && (
          <span className="text-sm text-red-600">{status}</span>
        )}
      </div>
    </form>
  );
}
