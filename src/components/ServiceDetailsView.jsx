"use client";

import { X } from "lucide-react";
import { useApp } from "../lib/AppContext.jsx";
import { formatVnd } from "../lib/booking.js";

// Read-only modal showing a service's details to the customer: name, price,
// description, photo, and short video. `service` = { name, price, description,
// imageUrl, videoUrl }.
export function ServiceDetailsView({ service, onClose }) {
  const { t } = useApp();
  if (!service) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <h3 className="font-display text-base font-black">{service.name}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {service.price != null ? (
            <p className="text-sm font-black text-wash-600">{formatVnd(service.price)}</p>
          ) : null}
          {service.imageUrl ? (
            <img src={service.imageUrl} alt="" className="mt-3 w-full rounded-xl object-cover" />
          ) : null}
          {service.videoUrl ? <video src={service.videoUrl} controls className="mt-3 w-full rounded-xl" /> : null}
          {service.description ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{service.description}</p>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">{t("noDetails")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
