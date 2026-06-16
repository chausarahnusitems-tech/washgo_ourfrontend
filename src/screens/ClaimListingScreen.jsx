"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Clock3, Info, MapPin, Store } from "lucide-react";
import { useApp } from "../lib/AppContext.jsx";
import { createClient } from "../lib/supabase/client.js";
import { fetchMyListingClaim, submitListingClaim, submitNewListing } from "../lib/data/api.js";
import { userLocation } from "../data/catalog.js";
import { InteractiveMap } from "../components/map/InteractiveMapDynamic.jsx";
import { AddressSearch } from "../components/owner/AddressSearch.jsx";
import { Button } from "../components/ui/Button.jsx";
import { cx } from "../lib/cx.js";

const inputClass =
  "min-h-11 w-full rounded-2xl border border-black/10 px-4 text-sm outline-none focus:border-wash-500";
const labelClass = "text-xs font-black uppercase tracking-wide text-neutral-500";

function Shell({ children }) {
  return (
    <section className="h-full overflow-y-auto bg-white lg:bg-mist">
      <div className="mx-auto w-full max-w-2xl px-5 py-8">{children}</div>
    </section>
  );
}

function CenterNote({ children }) {
  return (
    <Shell>
      <div className="mt-10 grid place-items-center gap-3 rounded-2xl border border-black/10 bg-white px-6 py-14 text-center">
        {children}
      </div>
    </Shell>
  );
}

// Step 1 of onboarding: a car-wash owner submits a short verification request —
// who they are (phone) and when we can come for a physical visit. New shops also
// give a name + map location so we know where to go. NO services/hours/photo are
// collected here: an admin physically verifies and accepts the request first;
// only then does the owner fill in the full details in their owner dashboard.
export function ClaimListingScreen({ shopId = null, isNew = false }) {
  const router = useRouter();
  const { auth, requireAuth, mode, catalog } = useApp();
  const supabase = useMemo(() => createClient(), []);

  const catalogShops = catalog.shops ?? [];
  const shop = isNew ? null : catalogShops.find((s) => s.id === shopId) ?? null;
  const catalogReady = isNew || catalogShops.length > 0;

  const [loading, setLoading] = useState(!isNew);
  const [claim, setClaim] = useState(null);
  const [editing, setEditing] = useState(false);
  const [done, setDone] = useState(false);

  // New-shop identity fields.
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [coords, setCoords] = useState(null);

  // Shared.
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Existing-claim prefill (claim mode only).
  useEffect(() => {
    if (isNew || mode !== "backend" || !supabase || !shopId || requireAuth) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    fetchMyListingClaim(supabase, shopId)
      .then((c) => {
        if (!active) return;
        setClaim(c);
        if (c) {
          setPhone(c.phone ?? "");
          setNote(c.note ?? "");
        }
      })
      .catch((err) => console.error("[washgo] load claim failed", err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [isNew, mode, supabase, shopId, requireAuth]);

  // Default the phone from the directory listing / profile when there's no claim.
  useEffect(() => {
    if (!claim) setPhone((p) => p || shop?.phone || auth.profile?.phone || "");
  }, [claim, shop?.phone, auth.profile?.phone]);

  function validate() {
    if (isNew && !name.trim()) return "Add your car wash name.";
    if (isNew && !coords) return "Pick your location on the map (or via address search).";
    if (!phone.trim()) return "Add a contact phone so we can reach you.";
    return null;
  }

  async function onSubmit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const shared = { phone: phone.trim(), note: note.trim() };
      if (isNew) {
        await submitNewListing(supabase, {
          ...shared,
          name: name.trim(),
          address: address.trim(),
          district: district.trim(),
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null
        });
        setDone(true);
      } else {
        await submitListingClaim(supabase, shopId, shared);
        const fresh = await fetchMyListingClaim(supabase, shopId);
        setClaim(fresh);
        setEditing(false);
      }
    } catch (err) {
      console.error("[washgo] submit verification request failed", err);
      setError(err?.message || "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Gated / status states ------------------------------------------------

  if (requireAuth) {
    return (
      <CenterNote>
        <Store className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm font-semibold text-ink">Sign in to list your car wash</p>
        <Button onClick={() => router.push("/login")} className="mt-1">
          Sign in
        </Button>
      </CenterNote>
    );
  }

  if (loading) {
    return <CenterNote>Loading…</CenterNote>;
  }

  if (done) {
    return (
      <CenterNote>
        <Clock3 className="h-9 w-9 text-amber-500" aria-hidden="true" />
        <p className="text-base font-black text-ink">Request submitted</p>
        <p className="max-w-sm text-sm text-neutral-500">
          Thanks! Our team will contact you to arrange a visit and verify your car wash in person.
          Once verified, you’ll get an owner account and can add your full details. This also applies
          for your owner account.
        </p>
        <Link href="/" className="mt-2 font-bold text-wash-500">
          Back to home
        </Link>
      </CenterNote>
    );
  }

  if (claim?.status === "approved") {
    return (
      <CenterNote>
        <BadgeCheck className="h-9 w-9 text-emerald-500" aria-hidden="true" />
        <p className="text-base font-black text-ink">You’re verified</p>
        <p className="max-w-sm text-sm text-neutral-500">
          {shop?.name || "Your shop"} is now in your owner dashboard. Add your services, hours and
          photos there, then use “Release publicly” to open for bookings.
        </p>
        <Link href="/owner/shops" className="mt-2 font-bold text-wash-500">
          Go to my shops
        </Link>
        <p className="mt-1 text-xs text-neutral-400">
          Don’t see it? Sign out and back in to refresh your access.
        </p>
      </CenterNote>
    );
  }

  if (!isNew && claim?.status === "pending" && !editing) {
    return (
      <Shell>
        <BackLink isNew={isNew} />
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="flex items-center gap-2 text-sm font-black text-amber-800">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
            Verification requested
          </p>
          <p className="mt-1 text-sm text-amber-700">
            We’ll arrange a visit to verify {shop?.name || "your shop"} in person. Once an admin
            accepts, it’ll appear in your owner dashboard where you add your full details and publish.
          </p>
        </div>
        <RequestSummary claim={claim} />
        <Button variant="secondary" onClick={() => setEditing(true)} className="mt-5">
          Edit contact details
        </Button>
      </Shell>
    );
  }

  if (!catalogReady) {
    return <CenterNote>Loading…</CenterNote>;
  }
  if (!isNew && (!shop || shop.listingType !== "directory")) {
    return (
      <CenterNote>
        <Info className="h-8 w-8 text-neutral-300" aria-hidden="true" />
        <p className="text-sm font-semibold text-ink">This listing can’t be claimed</p>
        <Link href="/explore" className="mt-1 text-sm font-bold text-wash-500">
          Back to the map
        </Link>
      </CenterNote>
    );
  }

  // ---- The request form -----------------------------------------------------

  return (
    <Shell>
      <BackLink isNew={isNew} />

      <header className="mt-3">
        <h1 className="font-display text-2xl font-black">
          {isNew ? "List your car wash" : `Claim ${shop.name}`}
        </h1>
        <p className="mt-1 flex items-start gap-2 text-sm text-neutral-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Request verification. Our team arranges a visit to confirm your shop in person. After an
          admin accepts, you’ll get an owner account and add your services, hours and photos there.
        </p>
        {!isNew && shop.address ? (
          <p className="mt-1 text-xs text-neutral-400">
            {shop.district ? `${shop.district} · ` : ""}
            {shop.address}
          </p>
        ) : null}
      </header>

      {/* New shop: name + location */}
      {isNew ? (
        <section className="mt-6">
          <h2 className={labelClass}>Car wash name</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sparkle Auto Wash"
            className={cx(inputClass, "mt-2")}
          />

          <h2 className={cx(labelClass, "mt-5")}>Location</h2>
          <p className="mt-1 mb-2 text-sm text-neutral-500">
            Search your address or tap the map to drop your pin so we know where to visit.
          </p>
          <AddressSearch
            onSelect={({ address: a, lat, lng }) => {
              setAddress(a);
              setCoords({ lat, lng });
            }}
          />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address"
            className={cx(inputClass, "mt-2")}
          />
          <input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="Area / District (optional)"
            className={cx(inputClass, "mt-2")}
          />
          <div className="mt-3 overflow-hidden rounded-2xl border border-black/10">
            <InteractiveMap
              className="h-64 w-full"
              shops={coords ? [{ id: "new", lat: coords.lat, lng: coords.lng }] : []}
              selectedId={coords ? "new" : null}
              onPick={(lat, lng) => setCoords({ lat, lng })}
              userLocation={userLocation}
            />
          </div>
          {coords ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Pin set at {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Contact */}
      <section className="mt-7">
        <h2 className={labelClass}>Contact phone</h2>
        <p className="mt-1 mb-2 text-sm text-neutral-500">So we can reach you to arrange the visit.</p>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+84 …"
          className={inputClass}
        />
      </section>

      {/* Meetup note */}
      <section className="mt-7">
        <h2 className={labelClass}>When can we visit? (optional)</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Preferred days/times for a visit, or anything that helps us verify your business."
          className="mt-2 w-full resize-none rounded-2xl border border-black/10 p-4 text-sm outline-none focus:border-wash-500"
        />
      </section>

      {error ? (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>
      ) : null}

      <Button onClick={onSubmit} disabled={submitting} className="mt-6 w-full">
        {submitting ? "Submitting…" : "Request verification"}
      </Button>
      <p className="mt-2 text-center text-xs text-neutral-400">
        Submitting also applies for your owner account. You add full details after an admin verifies
        and accepts your shop.
      </p>
    </Shell>
  );
}

function BackLink({ isNew }) {
  const href = isNew ? "/" : "/explore";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 transition hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {isNew ? "Back to home" : "Back to the map"}
    </Link>
  );
}

function RequestSummary({ claim }) {
  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-black/10 bg-white p-5">
      {claim.phone ? (
        <div>
          <p className={labelClass}>Contact phone</p>
          <p className="mt-1 text-sm text-ink">{claim.phone}</p>
        </div>
      ) : null}
      {claim.note ? (
        <div>
          <p className={labelClass}>Visit note</p>
          <p className="mt-1 text-sm text-ink">{claim.note}</p>
        </div>
      ) : null}
    </div>
  );
}
