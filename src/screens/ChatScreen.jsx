"use client";

import { useState } from "react";
import { useApp } from "../lib/AppContext.jsx";
import { useBackOr } from "../lib/useBackOr.js";
import { TopBar } from "../components/layout/TopBar.jsx";
import { Icon } from "../components/ui/Icon.jsx";

// Local-only support chat placeholder. Sending a message appends it plus a
// canned auto-reply — no network/backend. A real chat service will replace the
// local `messages` state later.
export function ChatScreen() {
  const { t } = useApp();
  const onBack = useBackOr("/");
  const [messages, setMessages] = useState(() => [
    { id: "greeting", from: "support", text: t("chatGreeting") }
  ]);
  const [draft, setDraft] = useState("");

  const send = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${prev.length}`, from: "me", text },
      { id: `s-${prev.length}`, from: "support", text: t("chatAutoReply") }
    ]);
    setDraft("");
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] bg-white lg:bg-mist">
      <div className="px-4 pt-7">
        <div className="mx-auto w-full max-w-2xl">
          <TopBar compact title={t("chatTitle")} subtitle={t("chatSubtitle")} onBack={onBack} />
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto px-4">
        <div className="mx-auto grid w-full max-w-2xl content-start gap-3 py-2">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.from === "me" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm ${
                  message.from === "me"
                    ? "bg-wash-500 text-white"
                    : "border border-black/10 bg-white text-ink"
                }`}
              >
                {message.text}
              </p>
            </div>
          ))}
          <p className="mt-2 text-center text-xs text-neutral-400">{t("chatDemoNote")}</p>
        </div>
      </div>

      <form onSubmit={send} className="border-t border-black/10 bg-white p-4">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("chatInputPlaceholder")}
            className="min-h-11 flex-1 rounded-full border border-black/10 bg-neutral-100 px-4 text-sm outline-none focus:ring-4 focus:ring-wash-500/20"
          />
          <button
            type="submit"
            aria-label={t("chatSend")}
            disabled={!draft.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-wash-500 text-white shadow-cta transition disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:shadow-none"
          >
            <Icon name="Send" className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
