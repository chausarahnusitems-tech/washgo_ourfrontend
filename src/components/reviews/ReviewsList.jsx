"use client";

import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { cx } from "../../lib/cx.js";
import { tagLabel } from "../chat/problemTags.js";

function roleLabel(role, t) {
  if (role === "owner") return t("roleOwner");
  if (role === "admin") return t("roleAdmin");
  return t("roleCustomer");
}

function Stars({ rating }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cx("h-4 w-4", n <= rating ? "fill-amber-400 text-amber-400" : "text-neutral-300")}
        />
      ))}
    </span>
  );
}

// Shared list of post-chat reviews. Used by the admin (all reviews) and owner
// (their shop chats) screens — they pass already-scoped `reviews`. When
// `chatHrefBase` is provided, each card links to its conversation
// (`<base>?c=<id>`) so the reviewer's chat can be opened directly.
export function ReviewsList({ reviews, loading, emptyText, chatHrefBase }) {
  const { t, lang } = useApp();
  const locale = lang === "vi" ? "vi-VN" : "en-US";

  if (loading) return <p className="mt-8 text-sm text-neutral-500">Loading…</p>;
  if (!reviews.length) {
    return (
      <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-12 text-center">
        <Star className="h-8 w-8 text-neutral-300" />
        <p className="mt-3 text-sm font-semibold text-ink">{emptyText || t("noReviews")}</p>
      </div>
    );
  }

  return (
    <ul className="mt-6 grid gap-3">
      {reviews.map((r) => {
        const subject = r.kind === "shop" ? r.shopName || "Shop" : t("supportThread");
        const who = r.reviewerName || r.reviewerEmail || "User";
        const href = chatHrefBase && r.conversationId ? `${chatHrefBase}?c=${r.conversationId}` : null;

        const inner = (
          <>
            <div className="flex items-center justify-between gap-3">
              <Stars rating={r.rating} />
              <span className="flex items-center gap-1 text-xs text-neutral-400">
                {new Date(r.createdAt).toLocaleDateString(locale, {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })}
                {href && <ChevronRight className="h-4 w-4 text-neutral-300" aria-hidden="true" />}
              </span>
            </div>
            {r.comment && <p className="mt-2 text-sm text-ink">{r.comment}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
              <span>
                {t("reviewFrom")}: <strong className="text-ink">{who}</strong> · {roleLabel(r.reviewerRole, t)}
              </span>
              <span>
                {t("reviewFor")}: <strong className="text-ink">{subject}</strong>
              </span>
            </div>
            {r.problemTags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {r.problemTags.map((slug) => (
                  <span
                    key={slug}
                    className="rounded-full bg-neutral-100 px-2 py-0.5 text-[0.65rem] font-bold text-neutral-600"
                  >
                    {tagLabel(slug, t)}
                  </span>
                ))}
              </div>
            )}
          </>
        );

        return (
          <li key={r.id}>
            {href ? (
              <Link
                href={href}
                className="block rounded-2xl border border-black/5 bg-white p-4 transition hover:border-wash-200 hover:bg-wash-50/50"
              >
                {inner}
              </Link>
            ) : (
              <div className="rounded-2xl border border-black/5 bg-white p-4">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
