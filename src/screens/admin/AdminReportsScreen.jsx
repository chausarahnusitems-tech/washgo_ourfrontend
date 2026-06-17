"use client";

import { useApp } from "../../lib/AppContext.jsx";
import { useConversationReports } from "../../lib/useConversationReports.js";
import { ReportsList } from "../../components/reports/ReportsList.jsx";

// Shop chats that customers or owners flagged for review (RLS grants admins the
// full set). Admins can open the chat and mark each report resolved.
export function AdminReportsScreen() {
  const { t } = useApp();
  const { reports, loading, setStatus } = useConversationReports();

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <header>
        <h1 className="font-display text-2xl font-black">{t("reportsTitle")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Conversations customers and owners flagged for your team to review.
        </p>
      </header>
      <ReportsList reports={reports} loading={loading} onSetStatus={setStatus} chatHrefBase="/admin/messages" />
    </div>
  );
}
