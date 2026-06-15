"use client";

import { useRef, useState } from "react";
import { ImagePlus, Store } from "lucide-react";
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

export function OwnerShopPhotos({ shop, uploadPhoto, update }) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null); // null | "uploading" | error
  const position = shop.image_position || "object-center";

  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    try {
      await uploadPhoto(shop.id, file);
      setStatus(null);
    } catch (err) {
      console.error("[washgo] photo upload failed", err);
      setStatus(err?.message || "Upload failed.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
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
        Upload a cover photo for your shop. Customers see this on the shop card.
      </p>

      <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl bg-neutral-100">
        {shop.image_url ? (
          <img
            src={shop.image_url}
            alt="Shop cover"
            className={cx("h-full w-full object-cover", position)}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-neutral-300">
            <Store className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={status === "uploading"}
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {status === "uploading" ? "Uploading…" : shop.image_url ? "Replace photo" : "Upload photo"}
        </Button>
        {status && status !== "uploading" && (
          <span className="text-sm text-red-600">{status}</span>
        )}
      </div>

      {shop.image_url && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-neutral-500">
            Framing
          </p>
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
