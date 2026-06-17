"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "./AppContext.jsx";
import { createClient } from "./supabase/client.js";
import { fetchConversationReviews } from "./data/api.js";

// Loads the conversation reviews the signed-in user may read. RLS scopes the
// rows: admins get every review, owners get reviews on their shop chats. The
// screen decides how to present/filter them.
export function useConversationReviews() {
  const { auth, mode } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const enabled = mode === "backend" && Boolean(supabase) && Boolean(auth.user);

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(enabled);

  const reload = useCallback(async () => {
    if (!enabled) {
      setReviews([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setReviews(await fetchConversationReviews(supabase));
    } catch (err) {
      console.error("[washgo] load reviews failed", err);
    } finally {
      setLoading(false);
    }
  }, [enabled, supabase]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { reviews, loading, reload };
}
