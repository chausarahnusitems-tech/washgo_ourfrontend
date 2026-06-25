"use client";

import { useEffect, useState } from "react";
import { getBrandMeta } from "../../data/carBrands.js";
import { Icon } from "../ui/Icon.jsx";
import { cx } from "../../lib/cx.js";

// Brand mark for a vehicle. Loads a real logo from /brands/<slug>.svg when one has
// been supplied; otherwise renders a clean colour + initials monogram (so we never
// embed trademarked logo artwork ourselves). `monogramOnly` skips the network
// lookup entirely — used in dense lists (the brand dropdown) to avoid many 404s.
export function BrandLogo({ brand, size = 48, monogramOnly = false, className }) {
  const meta = getBrandMeta(brand);
  const [status, setStatus] = useState("idle"); // idle | loaded | failed
  useEffect(() => setStatus("idle"), [meta.slug]);

  const box = { width: size, height: size };

  if (!meta.name) {
    return (
      <span
        className={cx("grid shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-400", className)}
        style={box}
      >
        <Icon name="Car" className="h-1/2 w-1/2" />
      </span>
    );
  }

  const tryImage = !monogramOnly && Boolean(meta.logo);
  return (
    <span
      className={cx(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl font-display font-black text-white",
        className
      )}
      style={{ ...box, backgroundColor: status === "loaded" ? "#ffffff" : meta.color }}
      aria-label={meta.name}
    >
      {status !== "loaded" ? (
        <span style={{ fontSize: Math.round(size * 0.34), lineHeight: 1 }}>{meta.initials}</span>
      ) : null}
      {tryImage && status !== "failed" ? (
        <img
          src={meta.logo}
          alt=""
          aria-hidden="true"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
          className={cx(
            "absolute inset-0 h-full w-full object-contain p-[14%] transition-opacity",
            status === "loaded" ? "opacity-100" : "opacity-0"
          )}
        />
      ) : null}
    </span>
  );
}
