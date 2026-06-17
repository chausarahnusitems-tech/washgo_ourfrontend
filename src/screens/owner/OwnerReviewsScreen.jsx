"use client";

import { useMemo } from "react";
import { useApp } from "../../lib/AppContext.jsx";
import { useConversationReviews } from "../../lib/useConversationReviews.js";
import { ReviewsList } from "../../components/reviews/ReviewsList.jsx";

// Reviews customers left on this owner's shop chats. RLS already scopes the
// fetch to conversations the owner participates in; filter to shop threads so a
// support review the owner may have left themselves isn't shown here.
export function OwnerReviewsScreen() {
  const { t } = useApp();
  const { reviews, loading } = useConversationReviews();
  const shopReviews = useMemo(() => reviews.filter((r) => r.kind === "shop"), [reviews]);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <header>
        <h1 className="font-display text-2xl font-black">{t("reviewsTitle")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Reviews customers left after chatting with your shops.
        </p>
      </header>
      <ReviewsList reviews={shopReviews} loading={loading} chatHrefBase="/owner/messages" />
    </div>
  );
}
