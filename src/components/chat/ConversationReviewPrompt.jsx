"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { cx } from "../../lib/cx.js";
import { Button } from "../ui/Button.jsx";

// Post-close prompt: rate the support/resolution experience (1..5 + optional
// comment). Shown to the non-admin requester after a thread is closed. For a
// shop (customer<->owner) thread, it reframes as "Rate the car wash".
export function ConversationReviewPrompt({ onSubmit, busy = false, isShop = false }) {
  const { t } = useApp();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <div className="border-t border-black/10 bg-white p-4">
      <p className="text-sm font-bold text-ink">{t(isShop ? "rateShop" : "rateExperience")}</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n}`}
            className="p-0.5"
          >
            <Star
              className={cx(
                "h-7 w-7 transition",
                n <= rating ? "fill-amber-400 text-amber-400" : "text-neutral-300"
              )}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("reviewComment")}
        rows={2}
        className="mt-3 w-full resize-none rounded-2xl border border-black/10 px-4 py-2 text-sm outline-none focus:border-wash-500"
      />
      <Button
        onClick={() => onSubmit(rating, comment)}
        disabled={busy || rating < 1}
        className="mt-3 w-full"
      >
        {t("submitReview")}
      </Button>
    </div>
  );
}
