"use client";

import { Check, X } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { formatVnd } from "../../lib/booking.js";
import { cx } from "../../lib/cx.js";
import { Button } from "../ui/Button.jsx";

// Renders an owner's add-on suggestion inside the chat timeline: name, price,
// optional explanation + photos, and a status. Only the customer (canRespond)
// sees Accept/Decline, and only while the suggestion is still pending.
// `suggestion` = { id, name, price, note, photo_urls, status }.
export function AddonSuggestionCard({ suggestion, canRespond = false, busy = false, onAccept, onReject }) {
  const { t } = useApp();
  if (!suggestion) return null;
  const photos = suggestion.photo_urls ?? [];
  const status = suggestion.status ?? "pending";
  const statusLabel = { pending: t("addonPending"), accepted: t("addonAccepted"), rejected: t("addonDeclined") }[status];
  const statusTone = {
    pending: "bg-amber-50 text-amber-700",
    accepted: "bg-emerald-50 text-emerald-700",
    rejected: "bg-neutral-100 text-neutral-500"
  }[status];

  return (
    <div className="max-w-[85%] overflow-hidden rounded-2xl border border-wash-200 bg-white text-ink shadow-sm sm:max-w-sm">
      <div className="flex items-center justify-between gap-2 bg-wash-50 px-3 py-2">
        <span className="text-[0.7rem] font-black uppercase tracking-wide text-wash-600">
          {t("addonSuggestionTitle")}
        </span>
        <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-black", statusTone)}>
          {statusLabel}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <strong className="font-display text-sm font-black">{suggestion.name}</strong>
          <span className="shrink-0 text-sm font-black text-wash-600">{formatVnd(suggestion.price ?? 0)}</span>
        </div>
        {suggestion.note ? (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-600">{suggestion.note}</p>
        ) : null}
        {photos.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover ring-1 ring-black/10" />
              </a>
            ))}
          </div>
        ) : null}
        {canRespond && status === "pending" ? (
          <div className="mt-3 flex gap-2">
            <Button onClick={onAccept} disabled={busy} className="min-h-9 flex-1 px-3 text-sm">
              <Check className="h-4 w-4" aria-hidden="true" />
              {t("addonAccept")}
            </Button>
            <Button variant="secondary" onClick={onReject} disabled={busy} className="min-h-9 flex-1 px-3 text-sm">
              <X className="h-4 w-4" aria-hidden="true" />
              {t("addonReject")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
