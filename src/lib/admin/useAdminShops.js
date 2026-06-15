"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext.jsx";
import { createClient } from "../supabase/client.js";
import { fetchAdminShops, setShopStatus } from "../data/api.js";

// Data hook for the admin moderation console. Loads every shop (optionally
// filtered by status) plus owner contact, and exposes the status transitions an
// admin can make. Only active in backend mode for a signed-in admin.
//
// `status` filters server-side; pass null/undefined for all shops.
export function useAdminShops(status) {
  const { auth, mode } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const isAdmin = auth.profile?.role === "admin";
  const enabled = mode === "backend" && Boolean(supabase) && isAdmin;

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setShops([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setShops(await fetchAdminShops(supabase, status));
    } catch (err) {
      console.error("[washgo] failed loading admin shops", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [enabled, supabase, status]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Move a shop's status and drop it from / keep it in the local list. When a
  // status filter is active and the new status no longer matches, remove the row
  // so the queue updates instantly; otherwise patch in place.
  const moveStatus = useCallback(
    async (shopId, nextStatus) => {
      await setShopStatus(supabase, shopId, nextStatus);
      setShops((prev) => {
        if (status && nextStatus !== status) {
          return prev.filter((s) => s.id !== shopId);
        }
        return prev.map((s) => (s.id === shopId ? { ...s, status: nextStatus } : s));
      });
    },
    [supabase, status]
  );

  const approve = useCallback((id) => moveStatus(id, "approved"), [moveStatus]);
  const sendBack = useCallback((id) => moveStatus(id, "draft"), [moveStatus]);
  const suspend = useCallback((id) => moveStatus(id, "suspended"), [moveStatus]);
  const reinstate = useCallback((id) => moveStatus(id, "approved"), [moveStatus]);

  return {
    enabled,
    shops,
    loading,
    error,
    reload,
    approve,
    sendBack,
    suspend,
    reinstate,
    moveStatus
  };
}
