"use client";

import { useApp } from "../../lib/AppContext.jsx";
import { Button } from "../ui/Button.jsx";

// Shown to the customer on a booking's shop thread once the wash is marked
// complete (booking status = "completed") while the chat is still open. Offers a
// one-tap close — which then surfaces the rating prompt — or to keep it open.
export function ConversationClosePrompt({ onClose, onDismiss, busy = false }) {
  const { t } = useApp();

  return (
    <div className="border-t border-black/10 bg-wash-50 px-4 py-3">
      <p className="text-sm font-semibold text-ink">{t("washCompletePrompt")}</p>
      <p className="mt-1 text-xs text-neutral-500">{t("closeChatNote")}</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={onClose} disabled={busy} className="min-h-9 px-4 text-sm">
          {t("closeChat")}
        </Button>
        <Button variant="secondary" onClick={onDismiss} disabled={busy} className="min-h-9 px-4 text-sm">
          {t("keepChatOpen")}
        </Button>
      </div>
    </div>
  );
}
