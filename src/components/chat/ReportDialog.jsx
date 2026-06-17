"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { Button } from "../ui/Button.jsx";

// Shown when a customer or owner reports a shop chat. Collects an optional
// reason, then flips to a confirmation once the report is filed. `onSubmit`
// returns true on success (the parent owns the RPC + busy state).
export function ReportDialog({ onSubmit, onCancel, busy = false }) {
  const { t } = useApp();
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    const ok = await onSubmit(reason);
    if (ok) setSent(true);
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-wash-50 text-wash-600">
          <Flag className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="mt-3 font-display text-lg font-black">{t("reportSentTitle")}</h3>
        <p className="mt-1 text-sm text-neutral-500">{t("reportSent")}</p>
        <Button onClick={onCancel} className="mt-5 w-full">
          {t("done")}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
      <h3 className="font-display text-lg font-black">{t("reportChatTitle")}</h3>
      <p className="mt-1 text-sm text-neutral-500">{t("reportChatHint")}</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("reportReasonPlaceholder")}
        rows={3}
        className="mt-3 w-full resize-none rounded-2xl border border-black/10 px-4 py-2 text-sm outline-none focus:border-wash-500"
      />
      <div className="mt-4 grid gap-2">
        <Button onClick={submit} disabled={busy} className="w-full">
          {busy ? t("uploading") : t("reportSubmit")}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-sm font-semibold text-neutral-500"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
