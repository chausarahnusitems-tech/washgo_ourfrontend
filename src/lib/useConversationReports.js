"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "./AppContext.jsx";
import { createClient } from "./supabase/client.js";
import { fetchConversationReports, setReportStatus } from "./data/api.js";

// Loads the conversation reports the signed-in user may read. RLS scopes the
// rows: admins get every report. `setStatus` flips a report open<->resolved
// (admin-only RPC) and refreshes the list.
export function useConversationReports() {
  const { auth, mode } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const enabled = mode === "backend" && Boolean(supabase) && Boolean(auth.user);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(enabled);

  const reload = useCallback(async () => {
    if (!enabled) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setReports(await fetchConversationReports(supabase));
    } catch (err) {
      console.error("[washgo] load reports failed", err);
    } finally {
      setLoading(false);
    }
  }, [enabled, supabase]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setStatus = useCallback(
    async (id, status) => {
      try {
        await setReportStatus(supabase, id, status);
        await reload();
      } catch (err) {
        console.error("[washgo] set report status failed", err);
      }
    },
    [supabase, reload]
  );

  return { reports, loading, reload, setStatus };
}
