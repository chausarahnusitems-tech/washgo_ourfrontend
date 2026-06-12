"use client";

import { formatVnd } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { useBackOr } from "../lib/useBackOr.js";
import { TopBar } from "../components/layout/TopBar.jsx";

// Map a ledger row's `kind` to its translated label.
const KIND_LABELS = {
  topup: "txTopUp",
  charge: "txCharge",
  refund: "txRefund",
  adjustment: "txAdjustment"
};

// "11 Jun 2026" style date from an ISO timestamp.
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return "";
  }
}

export function TransactionsScreen() {
  const { t, transactions } = useApp();
  const onBack = useBackOr("/account");

  // Newest first (copy before sorting so we don't mutate context state).
  const rows = [...(transactions ?? [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <section className="h-full overflow-y-auto bg-white px-4 py-7 lg:bg-mist">
      <div className="mx-auto grid w-full max-w-2xl content-start gap-6">
        <TopBar compact hideLogo title={t("transactionHistory")} onBack={onBack} />

        {rows.length ? (
          <ul className="grid gap-3">
            {rows.map((row) => (
              <TransactionRow key={row.id} row={row} t={t} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-black/10 bg-white p-5 text-center text-sm text-neutral-500">
            {t("noTransactions")}
          </p>
        )}
      </div>
    </section>
  );
}

function TransactionRow({ row, t }) {
  const positive = row.amount >= 0;
  const label = t(KIND_LABELS[row.kind] ?? "txAdjustment");
  const sign = positive ? "+" : "−";

  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white p-4">
      <div className="min-w-0">
        <strong className="block truncate text-sm font-black text-ink">{label}</strong>
        {row.note ? (
          <span className="block truncate text-xs text-neutral-500">{row.note}</span>
        ) : null}
        <span className="block text-xs text-neutral-500">{formatDate(row.created_at)}</span>
      </div>
      <strong
        className={`shrink-0 font-display text-base font-black ${
          positive ? "text-lime-700" : "text-wash-500"
        }`}
      >
        {sign}
        {formatVnd(Math.abs(row.amount))}
      </strong>
    </li>
  );
}
