"use client";

import Link from "next/link";
import { Flag, MessageCircle } from "lucide-react";
import { useApp } from "../../lib/AppContext.jsx";
import { cx } from "../../lib/cx.js";

function roleLabel(role, t) {
  if (role === "owner") return t("roleOwner");
  if (role === "admin") return t("roleAdmin");
  return t("roleCustomer");
}

// Admin list of reported shop chats. Each card shows who reported, which shop,
// the reason, and links to the conversation. `onSetStatus(id, status)` flips a
// report between 'open' and 'resolved'.
export function ReportsList({ reports, loading, onSetStatus, chatHrefBase = "/admin/messages" }) {
  const { t, lang } = useApp();
  const locale = lang === "vi" ? "vi-VN" : "en-US";

  if (loading) return <p className="mt-8 text-sm text-neutral-500">Loading…</p>;
  if (!reports.length) {
    return (
      <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-black/15 bg-white px-6 py-12 text-center">
        <Flag className="h-8 w-8 text-neutral-300" />
        <p className="mt-3 text-sm font-semibold text-ink">{t("noReports")}</p>
      </div>
    );
  }

  return (
    <ul className="mt-6 grid gap-3">
      {reports.map((r) => {
        const who = r.reporterName || r.reporterEmail || "User";
        const resolved = r.status === "resolved";
        const href = r.conversationId ? `${chatHrefBase}?c=${r.conversationId}` : null;

        return (
          <li key={r.id} className="rounded-2xl border border-black/5 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <span
                className={cx(
                  "rounded-full px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wide",
                  resolved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                )}
              >
                {resolved ? t("reportStatusResolved") : t("reportStatusOpen")}
              </span>
              <span className="text-xs text-neutral-400">
                {new Date(r.createdAt).toLocaleDateString(locale, {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })}
              </span>
            </div>

            {r.reason ? (
              <p className="mt-2 text-sm text-ink">{r.reason}</p>
            ) : (
              <p className="mt-2 text-sm italic text-neutral-400">{t("reportNoReason")}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
              <span>
                {t("reportedBy")}: <strong className="text-ink">{who}</strong> · {roleLabel(r.reporterRole, t)}
              </span>
              <span>
                {t("reviewFor")}: <strong className="text-ink">{r.shopName || "Shop"}</strong>
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {href && (
                <Link
                  href={href}
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-50"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("openChat")}
                </Link>
              )}
              <button
                type="button"
                onClick={() => onSetStatus(r.id, resolved ? "open" : "resolved")}
                className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-50"
              >
                {resolved ? t("reopen") : t("markResolved")}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
