"use client";

import { useEffect } from "react";
import { cx } from "../../lib/cx.js";

// Centered pop-up modal with a dimmed backdrop. Closes on backdrop click and on
// Escape, and locks body scroll while open. The backdrop itself scrolls so a tall
// panel stays reachable on short viewports. Renders nothing when closed.
export function Modal({ open, onClose, children, labelledBy, className }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] overflow-y-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          onClick={(event) => event.stopPropagation()}
          className={cx("w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl", className)}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
