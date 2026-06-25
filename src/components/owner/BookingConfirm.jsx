"use client";

import { useRef, useState } from "react";
import {
  Camera,
  Check,
  Image as ImageIcon,
  Loader2,
  ScanLine,
  TriangleAlert,
  X
} from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import {
  fetchBookingCustomer,
  rpcOwnerCompleteBooking,
  rpcOwnerMarkArrived,
  uploadBookingPhoto
} from "../../lib/data/api.js";
import { platesMatch } from "../../lib/plate.js";

// Recognise a licence plate from an image File using tesseract.js, entirely in
// the browser. Lazy-loaded so the ~MB OCR bundle never touches the initial load
// or SSR. Returns the best-guess plate string, or "" when nothing usable read.
async function recognisePlate(file) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    await worker.setParameters({
      // Plates are alphanumeric (+ Vietnamese separators); whitelisting lifts
      // accuracy a lot vs. free-form text.
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-."
    });
    const { data } = await worker.recognize(file);
    // A plate is short and dense — pick the line with the most alphanumerics.
    const best = String(data?.text ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ line, score: (line.match(/[A-Za-z0-9]/g) || []).length }))
      .sort((a, b) => b.score - a.score)[0];
    return (best?.line ?? "").toUpperCase();
  } finally {
    await worker.terminate();
  }
}

// Per-booking owner confirmation control shown in the owner bookings list.
//   upcoming  -> "Car arrived — intake photo"  (camera) -> owner_mark_arrived
//   arrived   -> "Scan plate & complete"       (camera + OCR) -> review -> complete
// `booking` is a fetchOwnerBookings row; `onChanged` refetches the list.
export function BookingConfirm({ booking, supabase, onChanged }) {
  const { t } = useApp();
  const intakeRef = useRef(null);
  const completeRef = useRef(null);

  const [phase, setPhase] = useState("idle"); // idle | uploading | reading | review | saving
  const [error, setError] = useState(null);
  const [plate, setPlate] = useState("");
  const [photoUrl, setPhotoUrl] = useState(null);
  const [customer, setCustomer] = useState(null);

  const status = booking.status; // raw DB status: 'upcoming' | 'in_progress'
  const expectedPlate = booking.expectedPlate || "";
  const busy = phase === "uploading" || phase === "reading" || phase === "saving";
  const matches = platesMatch(plate, expectedPlate);

  // --- Arrival: capture intake photo, mark arrived ----------------------------
  async function onIntakeFile(event) {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = "";
    if (!file) return;
    setError(null);
    setPhase("uploading");
    try {
      const url = await uploadBookingPhoto(supabase, booking.shopId, booking.id, "intake", file);
      await rpcOwnerMarkArrived(supabase, booking.id, url);
      setPhase("idle");
      onChanged?.();
    } catch (err) {
      console.error("[washgo] mark arrived failed", err);
      setError(t("cfmError"));
      setPhase("idle");
    }
  }

  // --- Completion: capture photo, OCR the plate, then review before saving ----
  async function onCompleteFile(event) {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = "";
    if (!file) return;
    setError(null);
    setPhase("uploading");
    try {
      const url = await uploadBookingPhoto(supabase, booking.shopId, booking.id, "completion", file);
      setPhotoUrl(url);
      // Resolve the customer name in the background (best-effort).
      fetchBookingCustomer(supabase, booking.id).then(setCustomer).catch(() => {});
      setPhase("reading");
      let read = "";
      try {
        read = await recognisePlate(file);
      } catch (err) {
        console.error("[washgo] plate OCR failed", err);
        setError(t("cfmOcrFailed"));
      }
      // Prefill with the OCR result, else the registered plate so the owner only
      // confirms (or corrects) rather than typing from scratch.
      setPlate(read || expectedPlate || "");
      setPhase("review");
    } catch (err) {
      console.error("[washgo] completion upload failed", err);
      setError(t("cfmError"));
      setPhase("idle");
    }
  }

  async function confirmComplete() {
    setError(null);
    setPhase("saving");
    try {
      await rpcOwnerCompleteBooking(supabase, booking.id, photoUrl, plate);
      onChanged?.();
    } catch (err) {
      console.error("[washgo] complete booking failed", err);
      setError(t("cfmError"));
      setPhase("review");
    }
  }

  function cancelReview() {
    setPhase("idle");
    setPlate("");
    setPhotoUrl(null);
    setCustomer(null);
    setError(null);
  }

  const reviewing = phase === "review" || phase === "saving";

  return (
    <div className="w-full">
      <input
        ref={intakeRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onIntakeFile}
        className="hidden"
      />
      <input
        ref={completeRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onCompleteFile}
        className="hidden"
      />

      {reviewing ? (
        <div className="rounded-xl border border-black/10 bg-neutral-50 p-3">
          <div className="flex items-start gap-3">
            {photoUrl && (
              <img src={photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              {customer?.full_name && (
                <p className="truncate text-xs text-neutral-500">
                  <span className="font-bold text-ink">{t("cfmCustomer")}:</span> {customer.full_name}
                </p>
              )}
              <label className="mt-1 block text-[0.65rem] font-black uppercase tracking-wide text-neutral-500">
                {t("cfmRecognisedPlate")}
              </label>
              <input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                disabled={phase === "saving"}
                className="mt-1 w-full max-w-[12rem] rounded-lg border border-black/10 px-2.5 py-1.5 text-sm font-bold uppercase tracking-wide outline-none focus:border-wash-500"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                {expectedPlate ? (
                  <>
                    <span className="text-neutral-500">
                      {t("cfmExpectedPlate")}: <span className="font-bold text-ink">{expectedPlate}</span>
                    </span>
                    {matches ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-600">
                        <Check className="h-3 w-3" aria-hidden="true" /> {t("cfmPlateMatch")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-600">
                        <TriangleAlert className="h-3 w-3" aria-hidden="true" /> {t("cfmPlateMismatch")}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-neutral-400">{t("cfmNoPlateOnFile")}</span>
                )}
              </div>
            </div>
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={confirmComplete}
              disabled={phase === "saving"}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {phase === "saving" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {phase === "saving" ? t("cfmSaving") : t("cfmComplete")}
            </button>
            <button
              type="button"
              onClick={cancelReview}
              disabled={phase === "saving"}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" /> {t("cfmCancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {status === "in_progress" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t("cfmCheckedIn")}
            </span>
          )}
          {status === "upcoming" ? (
            <button
              type="button"
              onClick={() => intakeRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-wash-500 px-3 py-1.5 text-xs font-bold text-white shadow-cta transition hover:bg-wash-600 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {phase === "uploading" ? t("cfmUploading") : t("cfmTakeIntake")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => completeRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {phase === "uploading"
                ? t("cfmUploading")
                : phase === "reading"
                  ? t("cfmReadingPlate")
                  : t("cfmScanComplete")}
            </button>
          )}
          {booking.intakePhotoUrl && (
            <a
              href={booking.intakePhotoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-black/10 px-2.5 py-1 text-xs font-bold text-neutral-600 transition hover:bg-neutral-50"
            >
              <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> {t("cfmIntakePhoto")}
            </a>
          )}
          {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
