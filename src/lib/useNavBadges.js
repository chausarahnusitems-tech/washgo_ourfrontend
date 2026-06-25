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
import { ensureSeen, getSeen, markSeen } from "./lastSeen.js";

// Notification counts for the owner/admin nav. Returns a map keyed by the nav
// item key ({ bookings, messages, reviews } for owners; { queue, claims,
// reports, messages, reviews } for admins). Counts are "new since you last
// opened that section" for time-based sections (bookings/reviews), live unread
// for messages, and outstanding work for admin queue/claims/reports.
const POLL_MS = 60000;

// Time-based sections clear when their page is opened (markSeen on navigation).
const TIME_ROUTES = [
  { match: "/owner/bookings", key: "owner:bookings" },
  { match: "/owner/reviews", key: "owner:reviews" },
  { match: "/admin/reviews", key: "admin:reviews" }
];

function isNewerThanSeen(items, uid, key) {
  const seen = getSeen(uid, key);
  return (items ?? []).filter((it) => it.createdAt && Date.parse(it.createdAt) > seen).length;
}

export function useNavBadges() {
  const { auth, mode } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const role = auth.profile?.role ?? null;
  const uid = auth.user?.id ?? null;
  const enabled = mode === "backend" && Boolean(uid) && (role === "owner" || role === "admin");

  const data = useRef({});
  const [counts, setCounts] = useState({});

  const recompute = useCallback(() => {
    const d = data.current;
    if (role === "owner") {
      setCounts({
        messages: d.unread ?? 0,
        bookings: isNewerThanSeen(d.bookings, uid, "owner:bookings"),
        reviews: isNewerThanSeen(d.reviews, uid, "owner:reviews")
      });
    } else if (role === "admin") {
      setCounts({
        messages: d.unread ?? 0,
        queue: d.pendingShops ?? 0,
        claims: d.pendingClaims ?? 0,
        reports: d.openReports ?? 0,
        reviews: isNewerThanSeen(d.reviews, uid, "admin:reviews")
      });
    } else {
      setCounts({});
    }
  }, [role, uid]);

  const load = useCallback(async () => {
    if (!enabled) {
      setCounts({});
      return;
    }
    try {
      if (role === "owner") {
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
  }, [enabled, role, uid, supabase, recompute]);

  // Baseline the time-based sections once so existing history isn't all "new".
  useEffect(() => {
    if (!enabled) return;
    ensureSeen(uid, "owner:bookings");
    ensureSeen(uid, "owner:reviews");
    ensureSeen(uid, "admin:reviews");
  }, [enabled, uid]);

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
