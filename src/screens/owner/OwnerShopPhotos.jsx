"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Star, Store, Trash2 } from "lucide-react";
import { createClient } from "../../lib/supabase/client.js";
import {
  addShopPhoto,
  fetchShopPhotos,
  removeShopPhoto,
  setCoverPhoto
} from "../../lib/data/api.js";
import { cx } from "../../lib/cx.js";
import { Button } from "../../components/ui/Button.jsx";

// Tailwind object-position classes the customer cards understand (adaptShop
// defaults to object-center). Lets the owner frame an off-center cover photo.
const POSITIONS = [
  ["object-center", "Center"],
  ["object-top", "Top"],
  ["object-bottom", "Bottom"],
  ["object-left", "Left"],
  ["object-right", "Right"]
];

// Multi-photo gallery for a shop (item 19). Photos live in shop_photos; one is
// the cover (mirrored to shops.image_url for fast card reads). `update` patches
// image_position (framing); `reload` refreshes the owner shop list after a cover
// change so the list thumbnail stays in sync.
export function OwnerShopPhotos({ shop, update, reload }) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // null | "uploading" | error
  const position = shop.image_position || "object-center";

  async function load() {
    setLoading(true);
    try {
      setPhotos(await fetchShopPhotos(supabase, shop.id));
    } catch (err) {
      console.error("[washgo] fetch shop photos failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.id]);

  const cover = photos.find((p) => p.is_cover) ?? photos[0] ?? null;

  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    try {
      await addShopPhoto(supabase, shop.id, file);
      await load();
      await reload?.();
      setStatus(null);
    } catch (err) {
      console.error("[washgo] photo upload failed", err);
      setStatus(err?.message || "Upload failed.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onRemove(photo) {
    setStatus("uploading");
    try {
      await removeShopPhoto(supabase, photo.id);
      // If we removed the cover, promote another photo (or clear the cover url).
      if (photo.is_cover) {
        const rest = photos.filter((p) => p.id !== photo.id);
        if (rest[0]) await setCoverPhoto(supabase, shop.id, rest[0].id, rest[0].url);
        else await update(shop.id, { image_url: null });
      }
      await load();
      await reload?.();
      setStatus(null);
    } catch (err) {
      console.error("[washgo] remove photo failed", err);
      setStatus(err?.message || "Could not remove photo.");
    }
  }

  async function onSetCover(photo) {
    try {
      await setCoverPhoto(supabase, shop.id, photo.id, photo.url);
      await load();
      await reload?.();
    } catch (err) {
      console.error("[washgo] set cover failed", err);
    }
  }

  async function setPosition(value) {
    try {
      await update(shop.id, { image_position: value });
    } catch (err) {
      console.error("[washgo] image position update failed", err);
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-neutral-500">
        Add several photos of your shop. The cover photo (★) is shown on the shop card; customers can
        swipe through the rest on the shop page.
      </p>

      {/* Cover preview */}
      <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl bg-neutral-100">
        {cover ? (
          <img src={cover.url} alt="Shop cover" className={cx("h-full w-full object-cover", position)} />
        ) : (
          <div className="grid h-full w-full place-items-center text-neutral-300">
            <Store className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      <div className="mt-4 flex items-center gap-3">
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={status === "uploading"}>
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {status === "uploading" ? "Uploading…" : "Add photo"}
        </Button>
        {status && status !== "uploading" && <span className="text-sm text-red-600">{status}</span>}
      </div>

      {/* Gallery grid */}
      {loading ? (
        <p className="mt-5 text-sm text-neutral-500">Loading…</p>
      ) : photos.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-2xl border border-black/5">
              <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
              {photo.is_cover ? (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-wash-500 px-2 py-0.5 text-[0.62rem] font-black text-white">
                  <Star className="h-3 w-3" aria-hidden="true" /> Cover
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetCover(photo)}
                  className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[0.62rem] font-black text-ink shadow hover:bg-white"
                >
                  <Star className="h-3 w-3" aria-hidden="true" /> Set as cover
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(photo)}
                aria-label="Remove"
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-red-600 shadow transition hover:bg-white"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Cover framing */}
      {cover && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-neutral-500">Cover framing</p>
          <div className="flex flex-wrap gap-2">
            {POSITIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPosition(value)}
                aria-pressed={position === value}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                  position === value
                    ? "border-wash-300 bg-wash-50 text-wash-600"
                    : "border-black/10 bg-white text-ink hover:bg-neutral-50"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
