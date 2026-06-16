"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext.jsx";
import { createClient } from "../supabase/client.js";
import {
  approveListingClaim,
  fetchListingClaims,
  fetchOwnerApplications,
  openSupportThread,
  rejectListingClaim,
  setOwnerStatus
} from "../data/api.js";

// Unified admin queue: shop verification requests (listing claims — new shops or
// claims of existing directory listings) AND standalone owner applications are
// shown together. Both require a physical visit before accepting. Approve/reject
// route to the right RPC per item; `message` opens the applicant's support thread
// so the admin can arrange the visit.
export function useAdminApplications() {
  const { auth, mode } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const enabled = mode === "backend" && Boolean(supabase) && auth.profile?.role === "admin";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [claims, owners] = await Promise.all([
        fetchListingClaims(supabase),
        fetchOwnerApplications(supabase)
      ]);
      const claimItems = claims.map((c) => ({
        type: "claim",
        key: c.id,
        claimId: c.id,
        userId: c.user_id,
        person: c.claimer,
        isNewShop: !c.shop_id,
        shopName: c.shop?.name || c.name || c.shop_id || "New car wash",
        shopAddress: c.shop?.address || c.address || null,
        shopDistrict: c.shop?.district || c.district || null,
        phone: c.phone || null,
        note: c.note || null,
        createdAt: c.created_at
      }));
      const ownerItems = owners.map((o) => ({
        type: "owner",
        key: `owner-${o.id}`,
        userId: o.id,
        person: { full_name: o.full_name, email: o.email },
        createdAt: o.created_at
      }));
      // Oldest first.
      const merged = [...claimItems, ...ownerItems].sort((a, b) =>
        String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""))
      );
      setItems(merged);
    } catch (err) {
      console.error("[washgo] failed loading applications", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [enabled, supabase]);

  useEffect(() => {
    reload();
  }, [reload]);

  const decide = useCallback(
    async (item, approveIt) => {
      if (item.type === "claim") {
        if (approveIt) await approveListingClaim(supabase, item.claimId);
        else await rejectListingClaim(supabase, item.claimId);
      } else {
        await setOwnerStatus(supabase, item.userId, approveIt ? "approved" : "rejected");
      }
      setItems((prev) => prev.filter((i) => i.key !== item.key));
    },
    [supabase]
  );

  const approve = useCallback((item) => decide(item, true), [decide]);
  const reject = useCallback((item) => decide(item, false), [decide]);

  // Open (find-or-create) the applicant's support thread; returns its id.
  const message = useCallback(
    (userId) => openSupportThread(supabase, userId),
    [supabase]
  );

  return { enabled, items, loading, error, reload, approve, reject, message };
}
