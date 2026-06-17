"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext.jsx";
import { createClient } from "../supabase/client.js";
import {
  createShop,
  deleteShop,
  fetchOwnerShops,
  setShopPublished,
  setShopServices,
  setShopStatus,
  updateShop,
  uploadShopPhoto
} from "../data/api.js";

// Self-contained data hook for the owner area. Kept out of AppContext (which is
// customer-focused) so the owner concern doesn't bloat the global provider. It
// wraps the api.js owner functions and keeps a local list of the owner's shops.
//
// Only meaningful in backend mode with a signed-in owner — demo mode has no
// owner concept, so it stays idle and empty there.
export function useOwnerShops() {
  const { auth, mode } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const ownerId = auth.user?.id ?? null;
  const enabled = mode === "backend" && Boolean(supabase) && Boolean(ownerId);

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
      setShops(await fetchOwnerShops(supabase, ownerId));
    } catch (err) {
      console.error("[washgo] failed loading owner shops", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [enabled, supabase, ownerId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (payload) => {
      const shop = await createShop(supabase, ownerId, payload);
      setShops((prev) => [shop, ...prev]);
      return shop;
    },
    [supabase, ownerId]
  );

  const update = useCallback(
    async (shopId, patch) => {
      const shop = await updateShop(supabase, shopId, patch);
      setShops((prev) => prev.map((s) => (s.id === shopId ? { ...s, ...shop } : s)));
      return shop;
    },
    [supabase]
  );

  const remove = useCallback(
    async (shopId) => {
      await deleteShop(supabase, shopId);
      setShops((prev) => prev.filter((s) => s.id !== shopId));
    },
    [supabase]
  );

  // Move a shop's status (owners may only pass 'draft' or 'pending').
  const submit = useCallback(
    async (shopId, status) => {
      await setShopStatus(supabase, shopId, status);
      setShops((prev) => prev.map((s) => (s.id === shopId ? { ...s, status } : s)));
    },
    [supabase]
  );

  // Release publicly / unpublish (only meaningful once approved).
  const setPublished = useCallback(
    async (shopId, published) => {
      await setShopPublished(supabase, shopId, published);
      setShops((prev) => prev.map((s) => (s.id === shopId ? { ...s, published } : s)));
    },
    [supabase]
  );

  const saveServices = useCallback(
    async (shopId, serviceIds) => {
      const next = await setShopServices(supabase, shopId, serviceIds);
      setShops((prev) =>
        prev.map((s) => (s.id === shopId ? { ...s, serviceIds: next } : s))
      );
      return next;
    },
    [supabase]
  );

  const uploadPhoto = useCallback(
    async (shopId, file) => {
      const shop = await uploadShopPhoto(supabase, shopId, file);
      setShops((prev) => prev.map((s) => (s.id === shopId ? { ...s, ...shop } : s)));
      return shop;
    },
    [supabase]
  );

  return {
    enabled,
    shops,
    loading,
    error,
    reload,
    create,
    update,
    remove,
    submit,
    setPublished,
    saveServices,
    uploadPhoto
  };
}
