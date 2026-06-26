"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "./AppContext.jsx";
import { createClient } from "./supabase/client.js";
import {
  fetchAdminShopCounts,
  fetchConversationReports,
  fetchConversationReviews,
  fetchConversations,
  fetchListingClaims,
  fetchOwnerBookings,
  fetchOwnerShops
} from "./data/api.js";
import { getSeen, markSeen } from "./lastSeen.js";

// Notification counts for the owner/admin nav. The badge SET is chosen by the
// AREA being viewed (/owner vs /admin), NOT the role — an admin who also owns a
// shop sees owner badges while in /owner and admin badges while in /admin.
//   owner: { bookings, messages, reviews }
//   admin: { queue, claims, reports, messages, reviews }
const POLL_MS = 60000;
// Items created within this window still count as "new" until their section is
// opened, so recent activity badges on first view (then clears when visited).
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Time-based sections clear when their page is opened (markSeen on navigation).
const TIME_ROUTES = [
  { match: "/owner/bookings", key: "owner:bookings" },
  { match: "/owner/reviews", key: "owner:reviews" },
  { match: "/admin/reviews", key: "admin:reviews" }
];

function newCount(items, uid, key) {
  const seen = Math.max(getSeen(uid, key), Date.now() - NEW_WINDOW_MS);
  return (items ?? []).filter((it) => it.createdAt && Date.parse(it.createdAt) > seen).length;
}

export function useNavBadges() {
  const { auth, mode } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const role = auth.profile?.role ?? null;
  const uid = auth.user?.id ?? null;
  const area = pathname.startsWith("/admin") ? "admin" : pathname.startsWith("/owner") ? "owner" : null;
  const enabled = mode === "backend" && Boolean(uid) && area !== null && (role === "owner" || role === "admin");

  const data = useRef({});
  const [counts, setCounts] = useState({});

  const recompute = useCallback(() => {
    const d = data.current;
    if (area === "owner") {
      setCounts({
        messages: d.unread ?? 0,
        bookings: newCount(d.bookings, uid, "owner:bookings"),
        reviews: newCount(d.reviews, uid, "owner:reviews")
      });
    } else if (area === "admin") {
      setCounts({
        messages: d.unread ?? 0,
        queue: d.pendingShops ?? 0,
        claims: d.pendingClaims ?? 0,
        reports: d.openReports ?? 0,
        reviews: newCount(d.reviews, uid, "admin:reviews")
      });
    } else {
      setCounts({});
    }
  }, [area, uid]);

  const load = useCallback(async () => {
    if (!enabled) {
      setCounts({});
      return;
    }
    try {
      if (area === "owner") {
        const [convs, shops, reviews] = await Promise.all([
          fetchConversations(supabase),
          fetchOwnerShops(supabase, uid),
          fetchConversationReviews(supabase)
        ]);
        const bookings = await fetchOwnerBookings(supabase, shops.map((s) => s.id));
        data.current = {
          unread: convs.filter((c) => c.unread).length,
          bookings,
          reviews: reviews.filter((r) => r.kind === "shop")
        };
      } else {
        const [convs, shopCounts, claims, reports, reviews] = await Promise.all([
          fetchConversations(supabase, "support"),
          fetchAdminShopCounts(supabase),
          fetchListingClaims(supabase),
          fetchConversationReports(supabase),
          fetchConversationReviews(supabase)
        ]);
        data.current = {
          unread: convs.filter((c) => c.unread).length,
          pendingShops: shopCounts.pending ?? 0,
          pendingClaims: claims.length,
          openReports: reports.filter((r) => r.status === "open").length,
          reviews
        };
      }
      recompute();
    } catch (err) {
      console.error("[washgo] nav badges load failed", err);
    }
  }, [enabled, area, uid, supabase, recompute]);

  // Fetch on mount + poll.
  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, load]);

  // Opening a time-based section marks it seen, clearing its badge.
  useEffect(() => {
    if (!enabled) return;
    const hit = TIME_ROUTES.find((r) => pathname === r.match || pathname.startsWith(`${r.match}/`));
    if (hit) markSeen(uid, hit.key);
    recompute();
  }, [enabled, pathname, uid, recompute]);

  return counts;
}
