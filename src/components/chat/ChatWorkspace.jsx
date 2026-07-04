"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Flag,
  Headset,
  Info,
  MessageCircle,
  Mic,
  Paperclip,
  Send,
  Sparkles,
  Store,
  Trash2,
  X
} from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { createClient } from "../../lib/supabase/client.js";
import {
  closeConversation,
  deleteConversation,
  hideConversation,
  fetchConversation,
  fetchConversationCustomer,
  fetchConversationReview,
  fetchConversations,
  fetchCustomServices,
  fetchMessages,
  rpcRespondAddon,
  rpcSuggestAddon,
  markConversationRead,
  openConversation,
  reportConversation,
  sendMessage,
  setConversationArchived,
  submitConversationReview,
  uploadChatAttachment
} from "../../lib/data/api.js";
import { cx } from "../../lib/cx.js";
import { parseIsoDate } from "../../lib/calendar.js";
import { tagLabel } from "./problemTags.js";
import { SupportTagPicker } from "./SupportTagPicker.jsx";
import { ConversationReviewPrompt } from "./ConversationReviewPrompt.jsx";
import { ConversationClosePrompt } from "./ConversationClosePrompt.jsx";
import { AddonSuggestionCard } from "./AddonSuggestionCard.jsx";
import { AddonComposerDialog } from "./AddonComposerDialog.jsx";
import { ReportDialog } from "./ReportDialog.jsx";
import { VoiceMessage } from "./VoiceMessage.jsx";

const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50MB cap for inline video uploads
const IMAGE_MAX_BYTES = 25 * 1024 * 1024; // 25MB cap for image uploads (incl. pasted)
const GROUP_GAP_MS = 5 * 60 * 1000; // messages >5min apart start a new visual group
// Preferred recording container/codec, in order — first the browser supports wins.
const AUDIO_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function roleLabel(role, t) {
  if (role === "owner") return t("roleOwner");
  if (role === "admin") return t("roleAdmin");
  return t("roleCustomer");
}

// Label a thread from the viewer's perspective. A support thread shows the OTHER
// party: the requester sees "Support" (admins), while an admin sees the
// requester's name + role ("Jane · Owner") for triage. Shop threads show the
// shop name.
function convLabel(c, uid, t, locale = "en-US") {
  if (c.kind === "support") {
    if (c.createdBy && c.createdBy === uid) return t("supportThread");
    const name = c.creatorName || c.creatorEmail || "User";
    return `${name} · ${roleLabel(c.creatorRole, t)}`;
  }
  const base = c.shopName || "Shop chat";
  // A per-booking thread is tagged with its session so multiple bookings at the
  // same shop are distinguishable (and the owner can't see the customer's name).
  if (c.bookingDate) {
    // parseIsoDate (local noon) avoids the UTC-midnight off-by-one on date-only values.
    const day = (parseIsoDate(c.bookingDate) ?? new Date(c.bookingDate)).toLocaleDateString(locale, {
      month: "short",
      day: "numeric"
    });
    return `${base} · ${day}${c.bookingSlot ? ` ${c.bookingSlot}` : ""}`;
  }
  return base;
}

// The DB stores attachment-only previews as bracketed sentinels; localize those,
// otherwise show the (already truncated) message body.
function formatPreview(raw, t) {
  if (!raw) return "";
  switch (raw) {
    case "[photo]":
      return t("previewPhoto");
    case "[video]":
      return t("previewVideo");
    case "[voice message]":
      return t("previewVoice");
    case "[attachment]":
      return t("previewAttachment");
    default:
      return raw;
  }
}

function sameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// Active (non-archived) threads: open first, then closed; newest within each.
function sortActive(list) {
  return [...list].sort((a, b) => {
    const ac = a.status === "closed" ? 1 : 0;
    const bc = b.status === "closed" ? 1 : 0;
    if (ac !== bc) return ac - bc;
    const at = new Date(a.status === "closed" ? a.closedAt ?? a.createdAt : a.createdAt).getTime();
    const bt = new Date(b.status === "closed" ? b.closedAt ?? b.createdAt : b.createdAt).getTime();
    return bt - at;
  });
}

function mmss(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Persisted (localStorage) set of conversation ids where the customer tapped
// "Keep open" on the wash-complete prompt, so the choice survives reloads /
// remounts instead of re-nagging them every session.
const CLOSE_PROMPT_DISMISSED_KEY = "washgo:closePromptDismissed";

function loadClosePromptDismissed() {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(CLOSE_PROMPT_DISMISSED_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function persistClosePromptDismissed(ids) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLOSE_PROMPT_DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

// Shared chat UI for all roles: a conversation list + the selected thread + a
// composer. RLS scopes which conversations load, so the same component serves
// customers, owners and admins. Props tune the entry points.
export function ChatWorkspace({ kindFilter = null, allowSupport = false, initialConversationId = null }) {
  const { auth, t, lang } = useApp();
  const supabase = useMemo(() => createClient(), []);
  const uid = auth.user?.id ?? null;
  const role = auth.profile?.role ?? null;
  const isAdmin = role === "admin";
  const locale = lang === "vi" ? "vi-VN" : "en-US";

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(initialConversationId);
  const [messages, setMessages] = useState([]);
  // Which conversation `messages` belongs to — guards effects against acting on
  // the previous thread's messages during the async switch.
  const [messagesConvId, setMessagesConvId] = useState(null);
  const [body, setBody] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [existingReview, setExistingReview] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [closingChat, setClosingChat] = useState(false);
  // Conversation ids where the customer tapped "keep open" on the wash-complete
  // prompt — hydrated from / persisted to localStorage (below) so it survives
  // reloads rather than re-nagging every session.
  const [closePromptDismissed, setClosePromptDismissed] = useState(() => new Set());
  // For a shop thread viewed by the shop OWNER (not the customer/creator): the
  // customer's name/phone, resolved via a SECURITY DEFINER RPC since profiles
  // RLS is self-only. Empty for the customer's own view or on error (the RPC
  // throws for non-owners).
  const [convCustomer, setConvCustomer] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const [showReport, setShowReport] = useState(false);
  // Owner add-on suggestion composer + the shop's custom services for its picker.
  const [showAddonComposer, setShowAddonComposer] = useState(false);
  const [shopCustomServices, setShopCustomServices] = useState([]);
  const [addonBusy, setAddonBusy] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [reportBusy, setReportBusy] = useState(false);
  // Object-URL thumbnail for a staged image attachment (revoked on change).
  const [previewUrl, setPreviewUrl] = useState(null);
  // A deep-linked thread (e.g. from the reviews page) may not be in the current
  // filtered list — fetch it on its own so the header/actions still render.
  const [extraConv, setExtraConv] = useState(null);
  // Issue-details side panel (support side only) and the frozen "unread" divider
  // position for the open thread.
  const [showDetails, setShowDetails] = useState(false);
  const [unreadAnchor, setUnreadAnchor] = useState(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const prevSendingRef = useRef(false);
  // Refocus the composer only after a TEXT send (not a voice note), and only if
  // the user is still on the thread they sent from.
  const refocusAfterSendRef = useRef(false);
  const sentConvIdRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recTimerRef = useRef(null);
  const cancelRecRef = useRef(false);
  // Last (conv, message) we marked read, and the last thread we captured an
  // unread anchor for — both guard against redundant work on the 4s poll.
  const readSyncRef = useRef({ convId: null, msgId: null });
  const enteredRef = useRef(null);
  // convId -> optimistic last_read_at we just wrote, so a stale poll snapshot
  // can't downgrade lastReadAt and briefly re-flag a just-read thread.
  const optimisticReadRef = useRef(new Map());

  const activeConv = conversations.find((c) => c.id === activeId) ?? extraConv;
  const isClosed = activeConv?.status === "closed";
  const isArchived = Boolean(activeConv?.archived);
  // Close keeps its broader permission (owner participant included); archive and
  // delete are limited to the requester or an admin (the RPCs re-check anyway).
  const canClose =
    !!activeConv && !isClosed && (isAdmin || activeConv.createdBy === uid || activeConv.kind === "shop");
  const canManage = !!activeConv && (isAdmin || activeConv.createdBy === uid);
  const isReviewTarget = isClosed && !isAdmin && activeConv?.createdBy === uid;
  // Once the owner marks the wash complete, prompt the customer (the thread
  // creator) to close their still-open booking chat — unless they've dismissed it.
  const showClosePrompt =
    !isClosed &&
    !isAdmin &&
    activeConv?.kind === "shop" &&
    activeConv?.createdBy === uid &&
    activeConv?.bookingStatus === "completed" &&
    !closePromptDismissed.has(activeConv?.id);
  // The support side (an admin, or the shop owner on a shop chat) gets an issue
  // details panel. The thread creator (customer) doesn't.
  const canSeeDetails =
    !!activeConv && (isAdmin || (activeConv.kind === "shop" && activeConv.createdBy && activeConv.createdBy !== uid));
  // Either party of a customer<->owner (shop) chat can report it to the admins.
  // Admins are the recipients, so they don't see a report button.
  const canReport = !!activeConv && activeConv.kind === "shop" && !isAdmin;
  // The shop owner (or admin) viewing a customer's per-booking thread — the party
  // who can suggest add-ons. The customer is activeConv.createdBy.
  const isShopOwnerView =
    !!activeConv && activeConv.kind === "shop" && !!activeConv.createdBy && activeConv.createdBy !== uid;

  const activeConvs = useMemo(() => sortActive(conversations.filter((c) => !c.archived)), [conversations]);
  const archivedConvs = useMemo(
    () =>
      conversations
        .filter((c) => c.archived)
        .sort((a, b) => new Date(b.archivedAt ?? b.createdAt) - new Date(a.archivedAt ?? a.createdAt)),
    [conversations]
  );

  // Index of the first message from the other party newer than the frozen
  // unread anchor — where the "Unread messages" divider goes (-1 = none). Only
  // when the loaded messages belong to the active thread, and only when there's a
  // real prior read position (a never-read thread isn't treated as all-unread).
  const firstUnreadIdx = useMemo(() => {
    if (!unreadAnchor || messagesConvId !== activeId || !messages.length) return -1;
    const anchorMs = new Date(unreadAnchor).getTime();
    return messages.findIndex((m) => m.sender_id !== uid && new Date(m.created_at).getTime() > anchorMs);
  }, [messages, messagesConvId, activeId, unreadAnchor, uid]);

  useEffect(() => {
    if (initialConversationId) setActiveId(initialConversationId);
  }, [initialConversationId]);

  // Hydrate persisted "keep open" dismissals on mount. Client-only: starts empty
  // on the server / first render and fills in after mount, so no hydration mismatch.
  useEffect(() => {
    setClosePromptDismissed(loadClosePromptDismissed());
  }, []);

  const reloadList = useCallback(async () => {
    if (!supabase || !uid) {
      setLoadingList(false);
      return;
    }
    try {
      const list = await fetchConversations(supabase, kindFilter);
      // Don't let a poll snapshot taken before our mark-read committed downgrade
      // lastReadAt and re-flag a just-read thread: keep the newer of the two.
      const opt = optimisticReadRef.current;
      const merged = list.map((c) => {
        const o = opt.get(c.id);
        if (o && (!c.lastReadAt || new Date(o) > new Date(c.lastReadAt))) {
          return {
            ...c,
            lastReadAt: o,
            unread: c.lastMessageAt ? new Date(c.lastMessageAt) > new Date(o) : false
          };
        }
        return c;
      });
      setConversations(merged);
      setActiveId((prev) => prev ?? sortActive(merged.filter((c) => !c.archived))[0]?.id ?? null);
    } catch (err) {
      console.error("[washgo] load conversations failed", err);
    } finally {
      setLoadingList(false);
    }
  }, [supabase, uid, kindFilter]);

  useEffect(() => {
    reloadList();
  }, [reloadList]);

  const loadMessages = useCallback(async () => {
    if (!supabase || !activeId) {
      setMessages([]);
      setMessagesConvId(null);
      return;
    }
    try {
      const list = await fetchMessages(supabase, activeId);
      setMessages(list);
      setMessagesConvId(activeId); // tag which thread these belong to
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

  // If the active thread isn't in the (possibly filtered) list — e.g. an admin
  // opened a shop chat from the reviews page — fetch it on its own so the header
  // and actions render. Cleared once it appears in the list.
  useEffect(() => {
    let active = true;
    if (!supabase || !activeId || conversations.some((c) => c.id === activeId)) {
      setExtraConv(null);
      return undefined;
    }
    fetchConversation(supabase, activeId)
      .then((c) => {
        if (active) setExtraConv(c);
      })
      .catch((err) => console.error("[washgo] load conversation failed", err));
    return () => {
      active = false;
    };
  }, [supabase, activeId, conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // On entering a thread, freeze the "unread" divider at the thread's stored
  // last-read mark. Only re-captures when the active thread actually changes (the
  // 4s poll re-runs this but short-circuits), so the divider stays put while you
  // read — and resets if you leave and come back.
  useEffect(() => {
    if (!activeId) {
      enteredRef.current = null;
      return;
    }
    if (enteredRef.current === activeId) return;
    enteredRef.current = activeId;
    const conv = conversations.find((c) => c.id === activeId) ?? extraConv;
    setUnreadAnchor(conv?.lastReadAt ?? null);
  }, [activeId, conversations, extraConv]);

  // Mark the active thread read on open and whenever a new last message arrives
  // (including the caller's own sends). Optimistically clears its unread flag so
  // the list updates instantly, before the next poll confirms it.
  useEffect(() => {
    // Only mark read once the loaded messages actually belong to the active
    // thread — otherwise a thread switch would mark the new thread read based on
    // the previous thread's (stale) messages and fire a redundant RPC.
    if (!supabase || !activeId || messagesConvId !== activeId || !messages.length) return;
    const lastId = messages[messages.length - 1].id;
    const sync = readSyncRef.current;
    if (sync.convId === activeId && sync.msgId === lastId) return;
    readSyncRef.current = { convId: activeId, msgId: lastId };
    const stamp = new Date().toISOString();
    optimisticReadRef.current.set(activeId, stamp);
    markConversationRead(supabase, activeId)
      .then(() => {
        setConversations((cur) =>
          cur.map((c) => (c.id === activeId ? { ...c, unread: false, lastReadAt: stamp } : c))
        );
      })
      .catch((err) => console.error("[washgo] mark read failed", err));
  }, [supabase, activeId, messagesConvId, messages]);

  useEffect(() => {
    let active = true;
    if (!supabase || !activeConv || activeConv.status !== "closed" || isAdmin || activeConv.createdBy !== uid) {
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
  }, [supabase, activeConv?.id, activeConv?.status, isAdmin, uid, activeConv?.createdBy]);

  // Resolve the customer's identity for a shop thread when the viewer is the
  // shop OWNER (i.e. a shop thread they didn't create). The RPC throws for
  // non-owners, so swallow errors and leave it empty — this never runs for the
  // customer's own view (createdBy === uid).
  useEffect(() => {
    let active = true;
    const isOwnerOfShopThread =
      !!activeConv && activeConv.kind === "shop" && activeConv.createdBy && activeConv.createdBy !== uid;
    if (!supabase || !isOwnerOfShopThread) {
      setConvCustomer(null);
      return undefined;
    }
    setConvCustomer(null);
    fetchConversationCustomer(supabase, activeConv.id)
      .then((c) => {
        if (active) setConvCustomer(c);
      })
      .catch(() => {
        if (active) setConvCustomer(null);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, activeConv?.id, activeConv?.kind, activeConv?.createdBy, uid]);

  // Tidy up any in-flight recording when the component unmounts.
  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  // Paste an image straight into the composer. Listens at document level so it
  // works whether or not the text input is focused; non-image pastes (e.g. text)
  // are left untouched so normal pasting still works.
  useEffect(() => {
    if (!activeId || isClosed) return undefined;
    function onPaste(e) {
      // Don't hijack pastes aimed at a modal (e.g. the report dialog's textarea).
      if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      // Index loop, not for..of/Array.from: DataTransferItemList isn't reliably
      // iterable (throws on iOS Safari).
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && (item.type || "").startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          const ext = (file.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
          const named = file.name
            ? file
            : new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type });
          attachFile(named); // shared validation path (size caps) with the picker
          return;
        }
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [activeId, isClosed]);

  // Live thumbnail for a staged image attachment; revoke the object URL when the
  // staged file changes or clears to avoid leaking blob URLs.
  useEffect(() => {
    if (pendingFile && (pendingFile.type || "").startsWith("image/")) {
      const url = URL.createObjectURL(pendingFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
    return undefined;
  }, [pendingFile]);

  // Keep focus on the composer after a TEXT message sends, so you can keep typing
  // without tapping back into the box. Only fires on the sending→idle edge (the
  // input is briefly disabled mid-send), never on first opening a thread, and
  // not after a voice note (the user never touched the keyboard) or once you've
  // switched to a different thread mid-send.
  useEffect(() => {
    if (
      refocusAfterSendRef.current &&
      prevSendingRef.current &&
      !sending &&
      activeId &&
      !isClosed &&
      sentConvIdRef.current === activeId
    ) {
      inputRef.current?.focus();
    }
    if (!sending) refocusAfterSendRef.current = false;
    prevSendingRef.current = sending;
  }, [sending, activeId, isClosed]);

  // Validate + stage a file for sending (shared by the picker and image paste).
  function attachFile(file) {
    if (!file) return;
    const type = file.type || "";
    if (type.startsWith("video/") && file.size > VIDEO_MAX_BYTES) {
      window.alert(t("videoTooLarge"));
      return;
    }
    if (type.startsWith("image/") && file.size > IMAGE_MAX_BYTES) {
      window.alert(t("imageTooLarge"));
      return;
    }
    setPendingFile(file);
  }

  function onPickFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    attachFile(file);
  }

  async function onSend(event) {
    event.preventDefault();
    const text = body.trim();
    const file = pendingFile;
    if ((!text && !file) || !activeId || !uid || isClosed) return;
    setBody("");
    setPendingFile(null);
    refocusAfterSendRef.current = true; // a text-composer send → keep focus after
    sentConvIdRef.current = activeId;
    setSending(true);
    try {
      let attachment = null;
      if (file) attachment = await uploadChatAttachment(supabase, activeId, uid, file);
      await sendMessage(supabase, activeId, uid, text, attachment);
      await loadMessages();
    } catch (err) {
      console.error("[washgo] send message failed", err);
      setBody(text);
      // Don't clobber an image pasted while this send was in flight.
      setPendingFile((cur) => cur ?? file);
    } finally {
      setSending(false);
    }
  }

  // ---- Voice messages (browser MediaRecorder) -----------------------------

  function stopTracks() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }

  function clearRecTimer() {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
  }

  async function onRecordingStop() {
    clearRecTimer();
    setRecording(false);
    const cancelled = cancelRecRef.current;
    cancelRecRef.current = false;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    const mime = mediaRecorderRef.current?.mimeType || "audio/webm";
    stopTracks();
    if (cancelled || !chunks.length || !activeId || !uid) return;
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
    const file = new File([new Blob(chunks, { type: mime })], `voice-${Date.now()}.${ext}`, { type: mime });
    setSending(true);
    try {
      const attachment = await uploadChatAttachment(supabase, activeId, uid, file);
      await sendMessage(supabase, activeId, uid, "", attachment);
      await loadMessages();
    } catch (err) {
      console.error("[washgo] send voice failed", err);
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    if (isClosed || recording) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      window.alert(t("micDenied"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = AUDIO_MIME_CANDIDATES.find(
        (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      cancelRecRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = onRecordingStop;
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecElapsed(0);
      recTimerRef.current = setInterval(() => setRecElapsed((s) => s + 1), 1000);
    } catch (err) {
      console.error("[washgo] mic error", err);
      stopTracks();
      window.alert(t("micDenied"));
    }
  }

  function finishRecording() {
    cancelRecRef.current = false;
    mediaRecorderRef.current?.stop();
  }

  function cancelRecording() {
    cancelRecRef.current = true;
    mediaRecorderRef.current?.stop();
  }

  // ---- Thread lifecycle ----------------------------------------------------

  async function confirmStartSupport(tags) {
    setStarting(true);
    try {
      const id = await openConversation(supabase, "support", null, tags);
      setShowTagPicker(false);
      await reloadList();
      setActiveId(id);
    } catch (err) {
      console.error("[washgo] open support failed", err);
      // Hit the concurrent-support-chat cap — tell the user to close one first.
      if (/support_chat_limit/i.test(err?.message || "")) {
        setShowTagPicker(false);
        window.alert(t("supportChatLimit"));
      }
    } finally {
      setStarting(false);
    }
  }

  async function onCloseChat() {
    if (!activeConv || !window.confirm(t("confirmCloseChat"))) return;
    try {
      await closeConversation(supabase, activeConv.id);
      await reloadList();
    } catch (err) {
      console.error("[washgo] close conversation failed", err);
    }
  }

  // Close from the wash-complete prompt. The prompt already asks the question, so
  // this skips the extra window.confirm that onCloseChat uses.
  async function onCloseFromPrompt() {
    if (!activeConv || closingChat) return;
    setClosingChat(true);
    try {
      await closeConversation(supabase, activeConv.id);
      await reloadList();
    } catch (err) {
      console.error("[washgo] close conversation failed", err);
    } finally {
      setClosingChat(false);
    }
  }

  function onDismissClosePrompt() {
    if (!activeConv) return;
    setClosePromptDismissed((prev) => {
      const next = new Set(prev).add(activeConv.id);
      persistClosePromptDismissed(next);
      return next;
    });
  }

  // Owner: load the shop's custom services (for the picker) then open the composer.
  async function openAddonComposer() {
    try {
      const rows = activeConv?.shopId ? await fetchCustomServices(supabase, activeConv.shopId) : [];
      setShopCustomServices(rows ?? []);
    } catch (err) {
      console.error("[washgo] load custom services failed", err);
      setShopCustomServices([]);
    }
    setShowAddonComposer(true);
  }

  // Owner: upload any photos to the chat bucket, then record the suggestion.
  async function onSuggestAddon({ name, price, note, files, customServiceId }) {
    if (!activeConv || addonBusy) return;
    setAddonBusy(true);
    try {
      const photos = [];
      for (const file of files ?? []) {
        if ((file.type || "").startsWith("image/") && file.size > IMAGE_MAX_BYTES) {
          window.alert(t("imageTooLarge"));
          continue;
        }
        const att = await uploadChatAttachment(supabase, activeConv.id, uid, file);
        photos.push(att.url);
      }
      await rpcSuggestAddon(supabase, {
        conv: activeConv.id,
        name,
        price,
        note: note || null,
        photos,
        customServiceId
      });
      setShowAddonComposer(false);
      await loadMessages();
      await reloadList();
    } catch (err) {
      console.error("[washgo] suggest add-on failed", err);
      window.alert(err?.message || "Could not send the suggestion.");
    } finally {
      setAddonBusy(false);
    }
  }

  // Customer: accept/reject a pending suggestion.
  async function onRespondAddon(suggestionId, accept) {
    if (respondingId) return;
    setRespondingId(suggestionId);
    try {
      await rpcRespondAddon(supabase, suggestionId, accept);
      await loadMessages();
      await reloadList();
    } catch (err) {
      console.error("[washgo] respond add-on failed", err);
    } finally {
      setRespondingId(null);
    }
  }

  async function onArchive(archived) {
    if (!activeConv) return;
    try {
      await setConversationArchived(supabase, activeConv.id, archived);
      if (archived) setActiveId(null);
      await reloadList();
    } catch (err) {
      console.error("[washgo] archive conversation failed", err);
    }
  }

  // Local "delete for me": hide from the caller's list, preserving the thread
  // (and any review) for the other party and for records.
  async function onHideChat() {
    if (!activeConv || !window.confirm(t("confirmHideChat"))) return;
    const id = activeConv.id;
    try {
      await hideConversation(supabase, id);
      setActiveId((cur) => (cur === id ? null : cur));
      await reloadList();
    } catch (err) {
      console.error("[washgo] hide conversation failed", err);
    }
  }

  // Admin-only hard purge ("delete for everyone"). The RPC refuses when a review
  // exists, so surface that case clearly.
  async function onDeleteChat() {
    if (!activeConv || !window.confirm(t("confirmDeleteChat"))) return;
    const delId = activeConv.id;
    try {
      await deleteConversation(supabase, delId);
      setActiveId((cur) => (cur === delId ? null : cur));
      await reloadList();
    } catch (err) {
      console.error("[washgo] delete conversation failed", err);
      window.alert(/review/i.test(err?.message || "") ? t("deleteReviewedBlocked") : (err?.message || "Delete failed"));
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

  // Report the active shop chat to the admins. Returns true on success so the
  // dialog can switch to its confirmation view.
  async function onReport(reason) {
    if (!activeConv) return false;
    setReportBusy(true);
    try {
      await reportConversation(supabase, activeConv.id, reason);
      return true;
    } catch (err) {
      console.error("[washgo] report conversation failed", err);
      window.alert(err?.message || "Report failed");
      return false;
    } finally {
      setReportBusy(false);
    }
  }

  if (!uid) {
    return (
      <div className="grid h-full place-items-center p-8 text-center text-sm text-neutral-500">
        Sign in to use chat.
      </div>
    );
  }

  const headerBtn =
    "shrink-0 inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50";

  // Issue-details side panel content (support side). Shows what we actually have
  // on the conversation — subject, status, who raised it, when, and the tags.
  function renderDetails() {
    const c = activeConv;
    if (!c) return null;
    const person = c.creatorName || c.creatorEmail || "—";
    const created = c.createdAt
      ? new Date(c.createdAt).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })
      : "—";
    const statusText = c.archived ? t("archived") : c.status === "closed" ? t("statusClosed") : t("statusOpen");
    const subject = c.kind === "shop" ? c.shopName || t("supportThread") : t("supportThread");
    const rows = [
      [t("detailSubject"), subject],
      [t("detailStatus"), statusText],
      [t("detailPerson"), `${person}${c.creatorRole ? ` · ${roleLabel(c.creatorRole, t)}` : ""}`],
      [t("detailCreated"), created]
    ];
    // Owner viewing a shop thread: surface the customer resolved via RPC.
    if (convCustomer?.full_name) {
      rows.push([
        t("customer"),
        `${convCustomer.full_name}${convCustomer.phone ? ` · ${convCustomer.phone}` : ""}`
      ]);
    }
    return (
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-display text-sm font-black uppercase tracking-wide text-neutral-500">
            {t("issueDetails")}
          </h4>
          <button
            type="button"
            onClick={() => setShowDetails(false)}
            aria-label={t("close")}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <dl className="mt-3 space-y-3">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[0.7rem] font-bold uppercase tracking-wide text-neutral-400">{k}</dt>
              <dd className="mt-0.5 text-sm text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {c.problemTags?.length > 0 && (
          <div className="mt-4">
            <p className="text-[0.7rem] font-bold uppercase tracking-wide text-neutral-400">{t("detailCategory")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {c.problemTags.map((slug) => (
                <span
                  key={slug}
                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-[0.65rem] font-bold text-neutral-600"
                >
                  {tagLabel(slug, t)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderConvItem(c) {
    const active = c.id === activeId;
    const unread = c.unread && !active; // never flag the thread you're reading
    const tags = c.problemTags || [];
    const tagText = tags.slice(0, 2).map((s) => tagLabel(s, t)).join(", ");
    const extraTags = tags.length - 2;
    const statusText = c.archived
      ? t("archived")
      : c.status === "closed"
        ? t("statusClosed")
        : tagText
          ? t("statusOpen")
          : "";
    const meta = [tagText && (extraTags > 0 ? `${tagText} +${extraTags}` : tagText), statusText]
      .filter(Boolean)
      .join(" · ");
    const preview = formatPreview(c.lastMessagePreview, t);
    const ts = c.lastMessageAt ? new Date(c.lastMessageAt) : null;
    const timeLabel = ts
      ? sameDay(ts, new Date())
        ? ts.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
        : ts.toLocaleDateString(locale, { month: "short", day: "numeric" })
      : "";
    return (
      <li key={c.id}>
        <button
          type="button"
          onClick={() => setActiveId(c.id)}
          className={cx(
            "flex w-full items-start gap-3 border-b border-black/5 px-4 py-3 text-left transition",
            active
              ? "bg-wash-50"
              : unread
                ? "bg-wash-50/40 hover:bg-wash-50/70"
                : "hover:bg-neutral-50"
          )}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500">
            {c.kind === "support" ? <Headset className="h-4 w-4" /> : <Store className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={cx("min-w-0 flex-1 truncate text-sm text-ink", unread ? "font-black" : "font-bold")}>
                {convLabel(c, uid, t, locale)}
                {unread && <span className="sr-only">, {t("unreadConversation")}</span>}
              </span>
              {timeLabel && (
                <span
                  className={cx(
                    "shrink-0 text-[0.65rem]",
                    unread ? "font-bold text-wash-600" : "text-neutral-500"
                  )}
                >
                  {timeLabel}
                </span>
              )}
            </span>
            {meta && (
              <span className="mt-0.5 block truncate text-[0.7rem] font-semibold text-neutral-500">{meta}</span>
            )}
            {(preview || unread) && (
              <span className="mt-0.5 flex items-center gap-2">
                <span className={cx("min-w-0 flex-1 truncate text-xs", unread ? "text-ink" : "text-neutral-500")}>
                  {preview || " "}
                </span>
                {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-wash-500" aria-hidden="true" />}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 sm:grid-cols-[360px_1fr]">
      {/* Conversation list */}
      <aside className={cx("flex flex-col border-r border-black/10 bg-white", activeId && "hidden sm:flex")}>
        <div className="flex items-center justify-between gap-2 border-b border-black/10 px-4 py-3">
          <h2 className="font-display text-lg font-black">Messages</h2>
          {allowSupport && !isAdmin && (
            <button
              type="button"
              onClick={() => setShowTagPicker(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-wash-600 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-wash-700"
            >
              <Headset className="h-4 w-4" aria-hidden="true" />
              {t("contactSupport")}
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingList ? (
            <p className="p-4 text-sm text-neutral-500">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-neutral-400">No conversations yet.</p>
          ) : (
            <>
              <ul>{activeConvs.map(renderConvItem)}</ul>
              {archivedConvs.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowArchived((v) => !v)}
                    className="flex w-full items-center gap-2 border-b border-black/5 px-4 py-2.5 text-left text-xs font-black uppercase tracking-wide text-neutral-500 hover:bg-neutral-50"
                  >
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                    {showArchived ? t("hideArchived") : t("showArchived")} ({archivedConvs.length})
                  </button>
                  {showArchived && <ul>{archivedConvs.map(renderConvItem)}</ul>}
                </>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={cx("flex min-h-0 bg-mist", !activeId && "hidden sm:flex")}>
        {activeId ? (
          <>
            {/* Chat column: header + messages + composer */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="border-b border-black/10 bg-white">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setActiveId(null)} className="sm:hidden" aria-label="Back">
                    <MessageCircle className="h-5 w-5 text-neutral-500" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-base font-black">
                      {convLabel(activeConv ?? {}, uid, t, locale)}
                    </h3>
                    {convCustomer?.full_name && (
                      <p className="truncate text-xs font-semibold text-neutral-500">
                        {t("customer")}: {convCustomer.full_name}
                      </p>
                    )}
                  </div>
                  {canSeeDetails && (
                    <button
                      type="button"
                      onClick={() => setShowDetails((v) => !v)}
                      aria-pressed={showDetails}
                      className={cx(headerBtn, "hidden lg:inline-flex", showDetails && "bg-neutral-100")}
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("details")}
                    </button>
                  )}
                  {/* Report a customer<->owner chat to the admins (either party). */}
                  {canReport && (
                    <button type="button" onClick={() => setShowReport(true)} className={headerBtn}>
                      <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("reportChat")}
                    </button>
                  )}
                  {/* Lifecycle actions. On a closed thread: admins can archive
                      (global) and hard-purge "for everyone"; everyone else gets a
                      local "delete from my list". */}
                  {!isClosed ? (
                    // Hidden while the wash-complete prompt is up so the customer
                    // sees a single "Close chat" affordance (the prompt), not two.
                    canClose && !showClosePrompt && (
                      <button type="button" onClick={onCloseChat} className={headerBtn}>
                        {t("closeChat")}
                      </button>
                    )
                  ) : (
                    <>
                      {canManage &&
                        (isArchived ? (
                          <button type="button" onClick={() => onArchive(false)} className={headerBtn}>
                            <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                            {t("unarchiveChat")}
                          </button>
                        ) : (
                          <button type="button" onClick={() => onArchive(true)} className={headerBtn}>
                            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                            {t("archiveChat")}
                          </button>
                        ))}
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={onDeleteChat}
                          className={cx(headerBtn, "text-red-600 hover:bg-red-50")}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("deleteForEveryone")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onHideChat}
                          className={cx(headerBtn, "text-red-600 hover:bg-red-50")}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("deleteChat")}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="px-4 py-4">
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const next = messages[i + 1];
                  const mine = m.sender_id === uid;
                  const tMs = new Date(m.created_at).getTime();
                  const newGroup =
                    !prev || prev.sender_id !== m.sender_id || tMs - new Date(prev.created_at).getTime() > GROUP_GAP_MS;
                  const endGroup =
                    !next || next.sender_id !== m.sender_id || new Date(next.created_at).getTime() - tMs > GROUP_GAP_MS;
                  const showDay = !prev || !sameDay(prev.created_at, m.created_at);
                  const time = new Date(m.created_at).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit"
                  });
                  const isVisualMedia =
                    m.attachment_url && (m.attachment_type === "image" || m.attachment_type === "video");
                  // Photo-only messages show the time overlaid on the image, so the
                  // bubble is mostly the photo (minimal coloured padding around it).
                  const overlayTime = isVisualMedia && !m.body && m.attachment_type === "image";
                  return (
                    <Fragment key={m.id}>
                      {showDay && (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-full bg-black/5 px-3 py-0.5 text-[0.65rem] font-bold text-neutral-500">
                            {new Date(m.created_at).toLocaleDateString(locale, {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </span>
                        </div>
                      )}
                      {i === firstUnreadIdx && (
                        <div
                          role="separator"
                          aria-label={t("unreadMessages")}
                          className="my-3 flex items-center gap-2 px-1"
                        >
                          <span className="h-px flex-1 bg-wash-200" aria-hidden="true" />
                          <span
                            aria-hidden="true"
                            className="rounded-full bg-wash-100 px-3 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-wash-700"
                          >
                            {t("unreadMessages")}
                          </span>
                          <span className="h-px flex-1 bg-wash-200" aria-hidden="true" />
                        </div>
                      )}
                      {m.addon ? (
                        <div className={cx("flex flex-col", mine ? "items-end" : "items-start", newGroup ? "mt-3" : "mt-0.5")}>
                          <AddonSuggestionCard
                            suggestion={m.addon}
                            canRespond={!isAdmin && activeConv?.createdBy === uid && !isClosed}
                            busy={respondingId === m.addon.id}
                            onAccept={() => onRespondAddon(m.addon.id, true)}
                            onReject={() => onRespondAddon(m.addon.id, false)}
                          />
                        </div>
                      ) : (
                      <div className={cx("flex flex-col", mine ? "items-end" : "items-start", newGroup ? "mt-3" : "mt-0.5")}>
                        <div
                          className={cx(
                            "flex max-w-[85%] flex-col overflow-hidden rounded-2xl text-sm sm:max-w-md",
                            isVisualMedia ? "p-1" : "px-3 py-2",
                            mine ? "bg-wash-500 text-white" : "bg-white text-ink shadow-sm ring-1 ring-black/5",
                            endGroup && (mine ? "rounded-br-md" : "rounded-bl-md")
                          )}
                        >
                          {isVisualMedia && (
                            <div className="relative">
                              {m.attachment_type === "image" ? (
                                <img
                                  src={m.attachment_url}
                                  alt="attachment"
                                  className="block max-h-80 w-full rounded-[0.9rem] object-cover"
                                />
                              ) : (
                                <video
                                  src={m.attachment_url}
                                  controls
                                  className="block max-h-80 w-full rounded-[0.9rem]"
                                />
                              )}
                              {overlayTime && (
                                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[0.6rem] font-medium text-white">
                                  {time}
                                </span>
                              )}
                            </div>
                          )}
                          {m.attachment_url && m.attachment_type === "audio" && (
                            <VoiceMessage src={m.attachment_url} mine={mine} />
                          )}
                          {m.body && (
                            <span className={cx("whitespace-pre-wrap break-words", isVisualMedia && "px-2 pt-1")}>
                              {m.body}
                            </span>
                          )}
                          {!overlayTime && (
                            <span
                              className={cx(
                                "mt-0.5 self-end text-[0.6rem] leading-none",
                                isVisualMedia && "px-2 pb-0.5",
                                mine ? "text-white/70" : "text-neutral-400"
                              )}
                            >
                              {time}
                            </span>
                          )}
                        </div>
                      </div>
                      )}
                    </Fragment>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </div>

            {isClosed ? (
              <>
                <div className="border-t border-black/10 bg-neutral-50 px-4 py-3 text-center text-sm text-neutral-500">
                  {isArchived ? t("archived") : t("chatClosed")}
                </div>
                {isReviewTarget &&
                  (existingReview ? (
                    <p className="border-t border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold text-wash-600">
                      {t(activeConv?.kind === "shop" ? "rateShopThanks" : "reviewThanks")}
                    </p>
                  ) : (
                    <ConversationReviewPrompt
                      onSubmit={onSubmitReview}
                      busy={reviewBusy}
                      isShop={activeConv?.kind === "shop"}
                    />
                  ))}
              </>
            ) : recording ? (
              <div className="border-t border-black/10 bg-white">
                <div className="flex items-center gap-3 p-3">
                  <span className="flex items-center gap-2 text-sm font-bold text-red-600">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
                    {t("recording")} {mmss(recElapsed)}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="rounded-full px-3 py-1.5 text-sm font-semibold text-neutral-500 hover:bg-neutral-100"
                    >
                      {t("cancelRecording")}
                    </button>
                    <button
                      type="button"
                      onClick={finishRecording}
                      aria-label={t("stopRecording")}
                      className="grid h-11 w-11 place-items-center rounded-full bg-wash-500 text-white"
                    >
                      <Send className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {showClosePrompt && (
                  <ConversationClosePrompt
                    onClose={onCloseFromPrompt}
                    onDismiss={onDismissClosePrompt}
                    busy={closingChat}
                  />
                )}
              <form onSubmit={onSend} className="border-t border-black/10 bg-white">
                <div className="p-3">
                  {pendingFile &&
                    (previewUrl ? (
                      <div className="relative mb-2 inline-block">
                        <img
                          src={previewUrl}
                          alt={pendingFile.name || t("attachment")}
                          className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/10"
                        />
                        <button
                          type="button"
                          onClick={() => setPendingFile(null)}
                          aria-label={t("removeAttachment")}
                          className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white shadow"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="mb-2 flex w-max items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="max-w-[12rem] truncate">{pendingFile.name}</span>
                        <button type="button" onClick={() => setPendingFile(null)} aria-label={t("removeAttachment")}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,video/*,audio/*"
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
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={sending}
                      aria-label={t("recordVoice")}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                    >
                      <Mic className="h-5 w-5" aria-hidden="true" />
                    </button>
                    {isShopOwnerView && activeConv?.bookingId && (
                      <button
                        type="button"
                        onClick={openAddonComposer}
                        disabled={sending}
                        aria-label={t("suggestAddon")}
                        title={t("suggestAddon")}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-wash-500 hover:bg-wash-50 disabled:opacity-50"
                      >
                        <Sparkles className="h-5 w-5" aria-hidden="true" />
                      </button>
                    )}
                    <input
                      ref={inputRef}
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
                </div>
              </form>
              </>
            )}
            </div>
            {canSeeDetails && showDetails && (
              <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-black/10 bg-white lg:flex">
                {renderDetails()}
              </aside>
            )}
          </>
        ) : (
          <div className="grid h-full w-full place-items-center p-8 text-center text-sm text-neutral-500">
            {t("emptyThread")}
          </div>
        )}
      </section>

      {showTagPicker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <SupportTagPicker onStart={confirmStartSupport} onCancel={() => setShowTagPicker(false)} busy={starting} />
        </div>
      )}

      {showReport && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <ReportDialog onSubmit={onReport} onCancel={() => setShowReport(false)} busy={reportBusy} />
        </div>
      )}

      {showAddonComposer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <AddonComposerDialog
            services={shopCustomServices}
            busy={addonBusy}
            onSubmit={onSuggestAddon}
            onCancel={() => setShowAddonComposer(false)}
          />
        </div>
      )}
    </div>
  );
}
