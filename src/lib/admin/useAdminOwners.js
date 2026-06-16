"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../AppContext.jsx";
import { createClient } from "../supabase/client.js";
import { fetchOwnerApplications, setOwnerStatus } from "../data/api.js";

// Admin queue of pending owner applications. Approve grants the owner role;
// reject sends them back to plain customer. Active only for a signed-in admin.
export function useAdminOwners() {
  const { auth, mode } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const enabled = mode === "backend" && Boolean(supabase) && auth.profile?.role === "admin";

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setApplications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setApplications(await fetchOwnerApplications(supabase));
    } catch (err) {
      console.error("[washgo] failed loading owner applications", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [enabled, supabase]);

  useEffect(() => {
    reload();
  }, [reload]);

  const decide = useCallback(
    async (userId, status) => {
      await setOwnerStatus(supabase, userId, status);
      // Drop the row from the pending list once decided.
      setApplications((prev) => prev.filter((a) => a.id !== userId));
    },
    [supabase]
  );

  const approve = useCallback((id) => decide(id, "approved"), [decide]);
  const reject = useCallback((id) => decide(id, "rejected"), [decide]);

  return { enabled, applications, loading, error, reload, approve, reject };
}
