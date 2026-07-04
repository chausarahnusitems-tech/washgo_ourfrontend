"use client";

import { useMemo, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { formatVnd } from "../../lib/booking.js";
import { Button } from "../ui/Button.jsx";

// Owner dialog to compose an add-on suggestion: pick one of the shop's custom
// services (prefills name + price) or enter a free-form name + price, an optional
// explanation, and optional photos. Calls onSubmit({ name, price, note, files,
// customServiceId }); the parent uploads the photos and calls the RPC.
export function AddonComposerDialog({ services = [], busy = false, onSubmit, onCancel }) {
  const { t } = useApp();
  const [customServiceId, setCustomServiceId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);

  const pick = (id) => {
    setCustomServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc) {
      setName(svc.name);
      setPrice(String(svc.price ?? ""));
    }
  };

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  const canSend = Boolean(name.trim()) && Number(price) >= 0 && !busy;

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-black">{t("suggestAddon")}</h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("close")}
          className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {services.length ? (
        <label className="mt-3 block">
          <span className="text-xs font-bold text-neutral-500">{t("addonPickService")}</span>
          <select
            value={customServiceId}
            onChange={(e) => pick(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-black/10 bg-neutral-50 px-3 text-sm outline-none focus:border-wash-500"
          >
            <option value="">{t("addonFreeForm")}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatVnd(s.price ?? 0)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="mt-3 block">
        <span className="text-xs font-bold text-neutral-500">{t("addonNameLabel")}</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setCustomServiceId("");
          }}
          className="mt-1 min-h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-wash-500"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-bold text-neutral-500">{t("addonPriceLabel")}</span>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-wash-500"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-xs font-bold text-neutral-500">{t("addonExplanationLabel")}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={t("addonExplanationPlaceholder")}
          className="mt-1 w-full resize-none rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-wash-500"
        />
      </label>

      <div className="mt-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            setFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-200"
        >
          <Paperclip className="h-3.5 w-3.5" /> {t("addonAddPhotos")}
        </button>
        {previews.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {previews.map((url, i) => (
              <div key={i} className="relative">
                <img src={url} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-black/10" />
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={t("removeAttachment")}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          onClick={() =>
            onSubmit({
              name: name.trim(),
              price: Number(price) || 0,
              note: note.trim(),
              files,
              customServiceId: customServiceId || null
            })
          }
          disabled={!canSend}
          className="min-h-11 flex-1"
        >
          {busy ? t("addonSending") : t("addonSend")}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy} className="min-h-11">
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
