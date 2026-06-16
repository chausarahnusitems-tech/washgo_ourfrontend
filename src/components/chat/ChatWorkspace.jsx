"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headset, MessageCircle, Send, Store } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { createClient } from "../../lib/supabase/client.js";
import {
  fetchConversations,
  fetchMessages,
  openConversation,
  sendMessage
} from "../../lib/data/api.js";
import { cx } from "../../lib/cx.js";

// Label a thread from the viewer's perspective. A support thread shows the OTHER
// party: the user themselves see "Support" (admins), while an admin sees the
// user's name/email. Shop threads show the shop name.
function convLabel(c, uid) {
  if (c.kind === "support") {
    if (c.createdBy && c.createdBy === uid) return "Support";
    return c.creatorName || c.creatorEmail || "User";
  }
  return c.shopName || "Shop chat";
}

// Shared chat UI for all roles: a conversation list + the selected thread + a
// composer. RLS scopes which conversations load, so the same component serves
// customers, owners and admins. Props tune the entry points.
export function ChatWorkspace({ kindFilter = null, allowSupport = false, initialConversationId = null }) {
  const { auth } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const uid = auth.user?.id ?? null;

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(initialConversationId);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const bottomRef = useRef(null);

  // Follow a changing `?c=` deep-link even on a same-route navigation (e.g. the
  // admin clicks "Message" on another applicant while already on /admin/messages).
  // useState only seeds activeId once, so a query-only change would otherwise be
  // ignored and keep the previous thread open.
  useEffect(() => {
    if (initialConversationId) setActiveId(initialConversationId);
  }, [initialConversationId]);

  const reloadList = useCallback(async () => {
    if (!supabase || !uid) {
      setLoadingList(false);
      return;
    }
    try {
      const list = await fetchConversations(supabase, kindFilter);
      setConversations(list);
      setActiveId((prev) => prev ?? list[0]?.id ?? null);
    } catch (err) {
      console.error("[washgo] load conversations failed", err);
    } finally {
      setLoadingList(false);
    }
  }, [supabase, uid, kindFilter]);

  useEffect(() => {
    reloadList();
  }, [reloadList]);

  // Load + poll messages for the active thread (simple polling beats wiring
  // realtime here; refetch every 4s and right after sending).
  const loadMessages = useCallback(async () => {
    if (!supabase || !activeId) {
      setMessages([]);
      return;
    }
    try {
      setMessages(await fetchMessages(supabase, activeId));
    } catch (err) {
      console.error("[washgo] load messages failed", err);
    }
  }, [supabase, activeId]);

  useEffect(() => {
    loadMessages();
    if (!activeId) return undefined;
    const timer = setInterval(loadMessages, 4000);
    return () => clearInterval(timer);
  }, [loadMessages, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function onSend(event) {
    event.preventDefault();
    const text = body.trim();
    if (!text || !activeId || !uid) return;
    setBody("");
    try {
      await sendMessage(supabase, activeId, uid, text);
      await loadMessages();
    } catch (err) {
      console.error("[washgo] send message failed", err);
      setBody(text); // restore on failure
    }
  }

  async function startSupport() {
    try {
      const id = await openConversation(supabase, "support");
      await reloadList();
      setActiveId(id);
    } catch (err) {
      console.error("[washgo] open support failed", err);
    }
  }

  if (!uid) {
    return (
      <div className="grid h-full place-items-center p-8 text-center text-sm text-neutral-500">
        Sign in to use chat.
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 sm:grid-cols-[280px_1fr]">
      {/* Conversation list */}
      <aside className={cx("flex flex-col border-r border-black/10 bg-white", activeId && "hidden sm:flex")}>
        <div className="flex items-center justify-between gap-2 border-b border-black/10 px-4 py-3">
          <h2 className="font-display text-lg font-black">Messages</h2>
          {allowSupport && (
            <button
              type="button"
              onClick={startSupport}
              className="inline-flex items-center gap-1 rounded-full bg-wash-50 px-3 py-1.5 text-xs font-black text-wash-600"
            >
              <Headset className="h-4 w-4" aria-hidden="true" />
              Support
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingList ? (
            <p className="p-4 text-sm text-neutral-500">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-neutral-400">No conversations yet.</p>
          ) : (
            <ul>
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cx(
                      "flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left transition",
                      c.id === activeId ? "bg-wash-50" : "hover:bg-neutral-50"
                    )}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500">
                      {c.kind === "support" ? <Headset className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                    </span>
                    <span className="truncate text-sm font-bold text-ink">{convLabel(c, uid)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={cx("flex min-h-0 flex-col bg-mist", !activeId && "hidden sm:flex")}>
        {activeId ? (
          <>
            <div className="flex items-center gap-2 border-b border-black/10 bg-white px-4 py-3">
              <button type="button" onClick={() => setActiveId(null)} className="sm:hidden" aria-label="Back">
                <MessageCircle className="h-5 w-5 text-neutral-500" />
              </button>
              <h3 className="font-display text-base font-black">
                {convLabel(conversations.find((c) => c.id === activeId) ?? {}, uid)}
              </h3>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {messages.map((m) => {
                const mine = m.sender_id === uid;
                return (
                  <div key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
                    <span
                      className={cx(
                        "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                        mine ? "bg-wash-500 text-white" : "bg-white text-ink"
                      )}
                    >
                      {m.body}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={onSend} className="flex items-center gap-2 border-t border-black/10 bg-white p-3">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type a message…"
                className="min-h-11 flex-1 rounded-full border border-black/10 px-4 text-sm outline-none focus:border-wash-500"
              />
              <button
                type="submit"
                disabled={!body.trim()}
                aria-label="Send"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wash-500 text-white disabled:bg-neutral-300"
              >
                <Send className="h-5 w-5" aria-hidden="true" />
              </button>
            </form>
          </>
        ) : (
          <div className="grid h-full place-items-center p-8 text-center text-sm text-neutral-500">
            Select a conversation to start chatting.
          </div>
        )}
      </section>
    </div>
  );
}
