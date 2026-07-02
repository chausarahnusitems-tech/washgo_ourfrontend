"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "./AppContext.jsx";
import { createClient } from "./supabase/client.js";
import { fetchConversations } from "./data/api.js";

// Number of conversations with unread messages for the signed-in customer, used
// to badge the Chat item in the top/bottom nav. Polls on an interval (the chat
// screen itself refreshes far more often once open). Returns 0 when signed out,
// in demo mode, or on error. Reads RLS-scoped conversations — for a customer
// that's their own threads; an owner/admin browsing the customer area sees their
// unread shop/support threads, which is still a sensible "you have messages" cue.
const POLL_MS = 60000;

export function useChatBadge() {
  const { auth, mode } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const uid = auth.user?.id ?? null;
  const enabled = mode === "backend" && Boolean(uid);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return undefined;
    }
    let active = true;
    const load = async () => {
      try {
        const convs = await fetchConversations(supabase);
        if (active) setCount(convs.filter((c) => c.unread).length);
      } catch (err) {
        console.error("[washgo] chat badge load failed", err);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [enabled, supabase]);

  return count;
}
