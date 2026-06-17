"use client";

import { useApp } from "../../lib/AppContext.jsx";
import { useConversationReviews } from "../../lib/useConversationReviews.js";
import { ReviewsList } from "../../components/reviews/ReviewsList.jsx";

// Every post-chat review on the platform (RLS grants admins full read).
export function AdminReviewsScreen() {
  const { t } = useApp();
  const { reviews, loading } = useConversationReviews();

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <header>
        <h1 className="font-display text-2xl font-black">{t("reviewsTitle")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Feedback left after support and shop chats were resolved.
        </p>
      </header>
      <ReviewsList reviews={reviews} loading={loading} chatHrefBase="/admin/messages" />
    </div>
  );
}
