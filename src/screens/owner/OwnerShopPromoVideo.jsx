"use client";

import { useMemo, useRef, useState } from "react";
import { Play, Trash2, Upload } from "lucide-react";
import { createClient } from "../../lib/supabase/client.js";
import { rpcBuyShopVideoFeature, updateShop, uploadShopVideo } from "../../lib/data/api.js";
import { Button } from "../../components/ui/Button.jsx";

// A shop can show a short (~5s) promo video on its customer card — but only while
// the paid feature is active (item 23). The owner uploads the clip and pays a
// monthly fee from their wallet to keep it live.
const MAX_SECONDS = 5;
const MAX_BYTES = 50 * 1024 * 1024; // 50MB, mirrors the chat attachment cap
const MONTHLY_FEE = "199.000₫";

export function OwnerShopPromoVideo({ shop, reload }) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null); // null | "uploading" | "buying" | error string

  const active =
    shop.video_feature_until && new Date(shop.video_feature_until) >= new Date(new Date().toDateString());
  const hasVideo = Boolean(shop.promo_video_url);

  function readDuration(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(v.duration || 0);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      v.src = url;
    });
  }

  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      window.alert("Video must be 50MB or smaller.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const duration = await readDuration(file);
    if (duration && duration > MAX_SECONDS + 0.5) {
      window.alert(`Video must be ${MAX_SECONDS} seconds or shorter.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setStatus("uploading");
    try {
      await uploadShopVideo(supabase, shop.id, file);
      await reload?.();
      setStatus(null);
    } catch (err) {
      console.error("[washgo] promo video upload failed", err);
      setStatus(err?.message || "Upload failed.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onRemove() {
    setStatus("uploading");
    try {
      await updateShop(supabase, shop.id, { promo_video_url: null });
      await reload?.();
      setStatus(null);
    } catch (err) {
      console.error("[washgo] remove promo video failed", err);
      setStatus(err?.message || "Could not remove.");
    }
  }

  async function onBuy() {
    setStatus("buying");
    try {
      await rpcBuyShopVideoFeature(supabase, shop.id);
      await reload?.();
      setStatus(null);
    } catch (err) {
      console.error("[washgo] buy video feature failed", err);
      window.alert(
        err?.message === "insufficient funds"
          ? "Not enough wallet balance to activate the promo video."
          : err?.message || "Could not activate."
      );
      setStatus(null);
    }
  }

  return (
    <div className="grid gap-5">
      <p className="text-sm text-neutral-500">
        Show a short ({MAX_SECONDS}-second) promo video of your wash on your shop card. It only appears
        to customers while the paid feature is active.
      </p>

      {/* Video preview */}
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-neutral-900">
        {hasVideo ? (
          <video src={shop.promo_video_url} controls playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-neutral-500">
            <Play className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="video/*" onChange={onFile} className="hidden" />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={status === "uploading"}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {status === "uploading" ? "Uploading…" : hasVideo ? "Replace video" : `Upload video (≤ ${MAX_SECONDS}s)`}
        </Button>
        {hasVideo && (
          <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onRemove} disabled={status === "uploading"}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove
          </Button>
        )}
        {status && !["uploading", "buying"].includes(status) && <span className="text-sm text-red-600">{status}</span>}
      </div>

      {/* Paid feature gating */}
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-emerald-700">Promo video active</p>
              <p className="text-xs text-neutral-500">Showing to customers until {shop.video_feature_until}.</p>
            </div>
            <Button variant="secondary" className="min-h-9 px-3 text-sm" onClick={onBuy} disabled={status === "buying"}>
              {status === "buying" ? "…" : `Extend · ${MONTHLY_FEE}/mo`}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink">Activate promo video</p>
              <p className="text-xs text-neutral-500">
                {MONTHLY_FEE} / month, charged from your wallet. Your customers will see the clip on your card.
              </p>
            </div>
            <Button className="min-h-9 px-3 text-sm" onClick={onBuy} disabled={status === "buying" || !hasVideo}>
              {status === "buying" ? "…" : "Activate"}
            </Button>
          </div>
        )}
        {!hasVideo && !active ? (
          <p className="mt-2 text-xs text-neutral-400">Upload a video first, then activate.</p>
        ) : null}
      </div>
    </div>
  );
}
