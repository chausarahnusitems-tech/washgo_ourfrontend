"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headset, MessageCircle, Paperclip, Send, Store, X } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { createClient } from "../../lib/supabase/client.js";
import {
  closeConversation,
  fetchConversationReview,
  fetchConversations,
  fetchMessages,
  openConversation,
  sendMessage,
  submitConversationReview,
  uploadChatAttachment
} from "../../lib/data/api.js";
import { cx } from "../../lib/cx.js";
import { tagLabel } from "./problemTags.js";
import { SupportTagPicker } from "./SupportTagPicker.jsx";
import { ConversationReviewPrompt } from "./ConversationReviewPrompt.jsx";

const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50MB cap for inline video uploads

function roleLabel(role, t) {
  if (role === "owner") return t("roleOwner");
  if (role === "admin") return t("roleAdmin");
  return t("roleCustomer");
}

// Label a thread from the viewer's perspective. A support thread shows the OTHER
// party: the requester sees "Support" (admins), while an admin sees the
// requester's name + role ("Jane · Owner") for triage. Shop threads show the
// shop name.
function convLabel(c, uid, t) {
  if (c.kind === "support") {
    if (c.createdBy && c.createdBy === uid) return "Support";
    const name = c.creatorName || c.creatorEmail || "User";
    return `${name} · ${roleLabel(c.creatorRole, t)}`;
  }
  return c.shopName || "Shop chat";
}

// Shared chat UI for all roles: a conversation list + the selected thread + a
// composer. RLS scopes which conversations load, so the same component serves
// customers, owners and admins. Props tune the entry points.
export function ChatWorkspace({ kindFilter = null, allowSupport = false, initialConversationId = null }) {
  const { auth, t, lang } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const uid = auth.user?.id ?? null;
  const role = auth.profile?.role ?? null;
  const locale = lang === "vi" ? "vi-VN" : "en-US";

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(initialConversationId);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [existingReview, setExistingReview] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;
  const isClosed = activeConv?.status === "closed";
  // Button is permissive; close_conversation re-checks authoritatively. Owners
  // are always participants of a 'shop' thread, so allow the action there.
  const canClose =
    !!activeConv && !isClosed && (role === "admin" || activeConv.createdBy === uid || activeConv.kind === "shop");
  // Only the non-admin requester is auto-prompted to review (RLS still allows any
  // non-admin participant, so this stays forward-compatible).
  const isReviewTarget = isClosed && role !== "admin" && activeConv?.createdBy === uid;

  // Follow a changing `?c=` deep-link even on a same-route navigation (e.g. the
  // admin clicks "Message" on another applicant while already on /admin/messages).
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

  // Load + poll the active thread (simple polling beats wiring realtime here).
  // Also refresh the conversation list each tick so a thread closed by the other
  // party (status) surfaces without a manual reload.
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
    const timer = setInterval(() => {
      loadMessages();
      reloadList();
    }, 4000);
    return () => clearInterval(timer);
  }, [loadMessages, reloadList, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // When a closed thread is open and the viewer is the review target, load any
  // existing review (to prefill / suppress the prompt). Keyed on primitives so
  // the 4s list refresh doesn't refetch every tick.
  useEffect(() => {
    let active = true;
    if (!supabase || !activeConv || activeConv.status !== "closed" || role === "admin" || activeConv.createdBy !== uid) {
      setExistingReview(null);
      return undefined;
    }
    fetchConversationReview(supabase, activeConv.id, uid)
      .then((r) => {
        if (active) setExistingReview(r);
      })
      .catch((err) => console.error("[washgo] load review failed", err));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, activeConv?.id, activeConv?.status, role, uid, activeConv?.createdBy]);

  function onPickFile(event) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if ((file.type || "").startsWith("video/") && file.size > VIDEO_MAX_BYTES) {
      window.alert(t("videoTooLarge"));
      return;
    }
    setPendingFile(file);
  }

  async function onSend(event) {
    event.preventDefault();
    const text = body.trim();
    const file = pendingFile;
    if ((!text && !file) || !activeId || !uid || isClosed) return;
    setBody("");
    setPendingFile(null);
    setSending(true);
    try {
      let attachment = null;
      if (file) attachment = await uploadChatAttachment(supabase, activeId, uid, file);
      await sendMessage(supabase, activeId, uid, text, attachment);
      await loadMessages();
    } catch (err) {
      console.error("[washgo] send message failed", err);
      setBody(text); // restore on failure
      setPendingFile(file);
    } finally {
      setSending(false);
    }
  }

  async function confirmStartSupport(tags) {
    setStarting(true);
    try {
      const id = await openConversation(supabase, "support", null, tags);
      setShowTagPicker(false);
      await reloadList();
      setActiveId(id);
    } catch (err) {
      console.error("[washgo] open support failed", err);
    } finally {
      setStarting(false);
    }
  }

  async function onCloseChat() {
    if (!activeConv || !window.confirm(t("confirmCloseChat"))) return;
    setClosing(true);
    try {
      await closeConversation(supabase, activeConv.id);
      await reloadList();
    } catch (err) {
      console.error("[washgo] close conversation failed", err);
    } finally {
      setClosing(false);
    }
  }

  async function onSubmitReview(rating, comment) {
    if (!activeConv || rating < 1) return;
    setReviewBusy(true);
    try {
      await submitConversationReview(supabase, activeConv.id, uid, rating, comment);
      setExistingReview({ rating, comment });
    } catch (err) {
      console.error("[washgo] submit review failed", err);
    } finally {
      setReviewBusy(false);
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
              onClick={() => setShowTagPicker(true)}
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
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{convLabel(c, uid, t)}</span>
                      {c.status === "closed" && (
                        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-neutral-400">
                          {t("chatClosed")}
                        </span>
                      )}
                    </span>
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
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-display text-base font-black">{convLabel(activeConv ?? {}, uid, t)}</h3>
                {activeConv?.problemTags?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {activeConv.problemTags.map((slug) => (
                      <span
                        key={slug}
                        className="rounded-full bg-neutral-100 px-2 py-0.5 text-[0.65rem] font-bold text-neutral-600"
                      >
                        {tagLabel(slug, t)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {canClose && (
                <button
                  type="button"
                  onClick={onCloseChat}
                  disabled={closing}
                  className="shrink-0 rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {t("closeChat")}
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {messages.map((m) => {
                const mine = m.sender_id === uid;
                return (
                  <div key={m.id} className={cx("flex flex-col", mine ? "items-end" : "items-start")}>
                    <span
                      className={cx(
                        "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                        mine ? "bg-wash-500 text-white" : "bg-white text-ink"
                      )}
                    >
                      {m.attachment_url && m.attachment_type === "image" && (
                        <img src={m.attachment_url} alt="attachment" className="mb-1 max-h-60 rounded-xl" />
                      )}
                      {m.attachment_url && m.attachment_type === "video" && (
                        <video src={m.attachment_url} controls className="mb-1 max-h-60 rounded-xl" />
                      )}
                      {m.body && <span className="whitespace-pre-wrap break-words">{m.body}</span>}
                    </span>
                    <time className="mt-0.5 px-1 text-[0.65rem] text-neutral-400">
                      {new Date(m.created_at).toLocaleString(locale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </time>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {isClosed ? (
              <>
                <div className="border-t border-black/10 bg-neutral-50 px-4 py-3 text-center text-sm text-neutral-500">
                  {t("chatClosed")}
                </div>
                {isReviewTarget &&
                  (existingReview ? (
                    <p className="border-t border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold text-wash-600">
                      {t("reviewThanks")}
                    </p>
                  ) : (
                    <ConversationReviewPrompt onSubmit={onSubmitReview} busy={reviewBusy} />
                  ))}
              </>
            ) : (
              <form onSubmit={onSend} className="border-t border-black/10 bg-white p-3">
                {pendingFile && (
                  <div className="mb-2 flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                    <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="max-w-[12rem] truncate">{pendingFile.name}</span>
                    <button type="button" onClick={() => setPendingFile(null)} aria-label="Remove attachment">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={onPickFile}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={sending}
                    aria-label={t("attach")}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                  >
                    <Paperclip className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={sending ? t("uploading") : "Type a message…"}
                    disabled={sending}
                    className="min-h-11 flex-1 rounded-full border border-black/10 px-4 text-sm outline-none focus:border-wash-500 disabled:bg-neutral-50"
                  />
                  <button
                    type="submit"
                    disabled={(!body.trim() && !pendingFile) || sending}
                    aria-label="Send"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wash-500 text-white disabled:bg-neutral-300"
                  >
                    <Send className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <div className="grid h-full place-items-center p-8 text-center text-sm text-neutral-500">
            Select a conversation to start chatting.
          </div>
        )}
      </section>

      {showTagPicker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <SupportTagPicker onStart={confirmStartSupport} onCancel={() => setShowTagPicker(false)} busy={starting} />
        </div>
      )}
    </div>
  );
}
