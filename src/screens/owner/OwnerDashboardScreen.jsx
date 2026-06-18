"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Coins, Plus, Store } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { useOwnerShops } from "../../lib/owner/useOwnerShops.js";
import { createClient } from "../../lib/supabase/client.js";
import { fetchOwnerBookings } from "../../lib/data/api.js";
import { ShopStatusBadge } from "../../components/owner/ShopStatusBadge.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { formatVnd } from "./format.js";

export function OwnerDashboardScreen() {
  const { auth } = useApp();
  const { shops, loading } = useOwnerShops();
  const supabase = useMemo(() => createClient(), []);
  const name = auth.profile?.full_name || "there";

  // Aggregate bookings across all the owner's shops for revenue + counts.
  const shopIds = useMemo(() => shops.map((s) => s.id), [shops]);
  const [bookings, setBookings] = useState([]);
  useEffect(() => {
    if (!supabase || shopIds.length === 0) {
      setBookings([]);
      return undefined;
    }
    let active = true;
    fetchOwnerBookings(supabase, shopIds)
      .then((rows) => active && setBookings(rows))
      .catch((err) => console.error("[washgo] owner bookings failed", err));
    return () => {
      active = false;
    };
  }, [supabase, shopIds]);

  // Revenue = total of every non-cancelled booking at the owner's shops.
  const revenue = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + (b.total ?? 0), 0);
  const upcomingCount = bookings.filter((b) => b.status === "upcoming").length;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">Hi, {name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage your car washes and submit them for approval.
          </p>
        </div>
        <Link href="/owner/shops/new">
          <Button>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New shop
          </Button>
        </Link>
      </header>

      {/* Revenue + activity */}
      <section className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/5 bg-gradient-to-br from-wash-500 to-wash-600 p-5 text-white">
          <span className="flex items-center gap-1.5 text-sm text-white/90">
            <Coins className="h-4 w-4" aria-hidden="true" />
            Revenue earned
          </span>
          <p className="mt-2 font-display text-3xl font-black">{formatVnd(revenue)}</p>
        </div>
        <Link
          href="/owner/bookings"
          className="rounded-2xl border border-black/5 bg-white p-5 transition hover:border-wash-300 hover:bg-wash-50/40"
        >
          <span className="flex items-center gap-1.5 text-sm text-neutral-500">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Upcoming bookings
          </span>
          <p className="mt-2 font-display text-3xl font-black text-ink">{upcomingCount}</p>
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-wash-600">
            View bookings →
          </span>
        </Link>
        <Link
          href="/owner/bookings"
          className="rounded-2xl border border-black/5 bg-white p-5 transition hover:border-wash-300 hover:bg-wash-50/40"
        >
          <span className="flex items-center gap-1.5 text-sm text-neutral-500">
            <Store className="h-4 w-4" aria-hidden="true" />
            Total bookings
          </span>
          <p className="mt-2 font-display text-3xl font-black text-ink">{bookings.length}</p>
        </Link>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-neutral-500">
          Your shops
        </h2>

        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : shops.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-12 text-center">
            <Store className="h-8 w-8 text-neutral-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-ink">No shops yet</p>
            <p className="mt-1 text-sm text-neutral-500">
              Create your first car wash to get started.
            </p>
            <Link href="/owner/shops/new" className="mt-4">
              <Button>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create a shop
              </Button>
            </Link>
          </div>
        ) : (
          <ul className="grid gap-2">
            {shops.map((shop) => (
              <li key={shop.id}>
                <Link
                  href={`/owner/shops/${shop.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 transition hover:bg-neutral-50"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-100">
                    {shop.image_url ? (
                      <img src={shop.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5 text-neutral-400" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">
                      {shop.name || "Untitled shop"}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {shop.district || shop.address || "No address yet"}
                    </span>
                  </span>
                  <ShopStatusBadge status={shop.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
