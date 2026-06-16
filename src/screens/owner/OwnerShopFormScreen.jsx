"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, MapPin, Send, Undo2 } from "lucide-react";
import { userLocation } from "../../data/catalog.js";
import { useOwnerShops } from "../../lib/owner/useOwnerShops.js";
import { cx } from "../../lib/cx.js";
import { Button } from "../../components/ui/Button.jsx";
import { InteractiveMap } from "../../components/map/InteractiveMapDynamic.jsx";
import { AddressSearch, timeOptions } from "../../components/owner/AddressSearch.jsx";
import { ShopStatusBadge } from "../../components/owner/ShopStatusBadge.jsx";
import { OwnerShopServices } from "./OwnerShopServices.jsx";
import { OwnerShopPhotos } from "./OwnerShopPhotos.jsx";
import { OwnerShopSchedule } from "./OwnerShopSchedule.jsx";
import { OwnerBookings } from "./OwnerBookings.jsx";

const inputClass =
  "min-h-11 w-full rounded-2xl border border-black/10 px-4 text-sm outline-none focus:border-wash-500";
const labelClass = "text-xs font-black uppercase tracking-wide text-neutral-500";
const TIME_OPTIONS = timeOptions(30);

const TABS = ["details", "photos", "services", "schedule", "bookings"];
const TAB_LABELS = {
  details: "Details",
  photos: "Photos",
  services: "Services",
  schedule: "Schedule",
  bookings: "Bookings"
};

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
          <StatusActions shop={shop} submit={owner.submit} setPublished={owner.setPublished} />
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
        {isEdit && tab === "schedule" && <OwnerShopSchedule shop={shop} />}
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

// Status transitions + the "release publicly" switch.
function StatusActions({ shop, submit, setPublished }) {
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error("[washgo] status/publish change failed", err);
      window.alert(err?.message || "Could not update. Please try again.");
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
        <Button className="min-h-9 px-3 text-sm" disabled={busy} onClick={() => run(() => submit(shop.id, "pending"))}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Submit for review
        </Button>
      </div>
    );
  }
  if (shop.status === "pending") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3">
        <p className="flex-1 text-sm text-amber-800">
          Submitted for review. An admin will approve it before you can release it.
        </p>
        <Button variant="secondary" className="min-h-9 px-3 text-sm" disabled={busy} onClick={() => run(() => submit(shop.id, "draft"))}>
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          Withdraw
        </Button>
      </div>
    );
  }
  if (shop.status === "approved") {
    const canPublish = (shop.serviceIds?.length ?? 0) > 0 && shop.address && shop.open_time && shop.close_time;
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
        <p className="flex-1 text-sm text-emerald-800">
          Approved.{" "}
          {shop.published
            ? "Your shop is live and bookable."
            : "Release it publicly when you're ready to take bookings."}
        </p>
        {shop.published ? (
          <Button variant="secondary" className="min-h-9 px-3 text-sm" disabled={busy} onClick={() => run(() => setPublished(shop.id, false))}>
            <EyeOff className="h-4 w-4" aria-hidden="true" />
            Unpublish
          </Button>
        ) : (
          <Button
            className="min-h-9 px-3 text-sm"
            disabled={busy || !canPublish}
            title={canPublish ? undefined : "Add hours, address and at least one service first"}
            onClick={() => run(() => setPublished(shop.id, true))}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Release publicly
          </Button>
        )}
      </div>
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
    open_time: (shop?.open_time ?? "08:00").slice(0, 5),
    close_time: (shop?.close_time ?? "18:00").slice(0, 5),
    slot_minutes: shop?.slot_minutes ?? 60,
    max_cars_per_slot: shop?.max_cars_per_slot ?? 1,
    lat: shop?.lat ?? null,
    lng: shop?.lng ?? null
  }));
  const [status, setStatus] = useState(null);

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setStatus(null);
  };

  const pickLocation = (lat, lng) => {
    setForm((prev) => ({ ...prev, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }));
    setStatus(null);
  };

  const onAddress = ({ address, lat, lng }) => {
    setForm((prev) => ({
      ...prev,
      address,
      lat: Number.isFinite(lat) ? Number(lat.toFixed(6)) : prev.lat,
      lng: Number.isFinite(lng) ? Number(lng.toFixed(6)) : prev.lng
    }));
    setStatus(null);
  };

  const hasPoint = form.lat != null && form.lng != null;
  const pins = useMemo(
    () => (hasPoint ? [{ id: "picked", lat: form.lat, lng: form.lng }] : []),
    [hasPoint, form.lat, form.lng]
  );

  async function onSubmit(event) {
    event.preventDefault();
    // Compulsory: name, contact, location, opening hours.
    if (!form.name.trim()) return setStatus("Please enter a shop name.");
    if (!form.phone.trim()) return setStatus("Please add a contact phone number.");
    if (!form.address.trim()) return setStatus("Please add the shop address.");
    if (!(form.close_time > form.open_time)) return setStatus("Closing time must be after opening time.");

    setStatus("saving");
    try {
      await onSave({
        name: form.name.trim(),
        district: form.district.trim() || null,
        address: form.address.trim(),
        phone: form.phone.trim(),
        starting_price: form.starting_price === "" ? 0 : Math.round(Number(form.starting_price)),
        hours: `${form.open_time}–${form.close_time}`,
        open_time: form.open_time,
        close_time: form.close_time,
        slot_minutes: Number(form.slot_minutes),
        max_cars_per_slot: Math.max(1, Math.round(Number(form.max_cars_per_slot) || 1)),
        is_open: true,
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
        <label className={labelClass} htmlFor="shop-name">Shop name *</label>
        <input id="shop-name" required value={form.name} onChange={set("name")} placeholder="Lotus Detail Studio" className={inputClass} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="shop-district">District</label>
          <input id="shop-district" value={form.district} onChange={set("district")} placeholder="District 7" className={inputClass} />
        </div>
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="shop-phone">Contact phone *</label>
          <input id="shop-phone" value={form.phone} onChange={set("phone")} placeholder="+84 ..." className={inputClass} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label className={labelClass}>Address *</label>
        <AddressSearch onSelect={onAddress} />
        <input
          value={form.address}
          onChange={set("address")}
          placeholder="Selected address appears here — or type it"
          className={cx(inputClass, "mt-1")}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="shop-open">Opening time *</label>
          <select id="shop-open" value={form.open_time} onChange={set("open_time")} className={inputClass}>
            {TIME_OPTIONS.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="shop-close">Closing time *</label>
          <select id="shop-close" value={form.close_time} onChange={set("close_time")} className={inputClass}>
            {TIME_OPTIONS.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="shop-price">Starting price (₫)</label>
          <input id="shop-price" type="number" min="0" step="1000" value={form.starting_price} onChange={set("starting_price")} placeholder="120000" className={inputClass} />
        </div>
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="shop-cap">Max cars / slot</label>
          <input id="shop-cap" type="number" min="1" value={form.max_cars_per_slot} onChange={set("max_cars_per_slot")} className={inputClass} />
        </div>
        <div className="grid gap-1.5">
          <label className={labelClass} htmlFor="shop-slot">Slot length</label>
          <select id="shop-slot" value={form.slot_minutes} onChange={set("slot_minutes")} className={inputClass}>
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
            <option value={90}>90 min</option>
            <option value={120}>120 min</option>
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <span className={labelClass}>Location pin</span>
        <p className="flex items-center gap-1.5 text-xs text-neutral-500">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {hasPoint ? `${form.lat}, ${form.lng} — tap the map to adjust` : "Search an address above or tap the map to drop a pin."}
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
        {status === "saved" && <span className="text-sm font-semibold text-emerald-600">Saved</span>}
        {status && !["saving", "saved"].includes(status) && (
          <span className="text-sm text-red-600">{status}</span>
        )}
      </div>
    </form>
  );
}
