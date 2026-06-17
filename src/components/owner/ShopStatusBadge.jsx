import { cx } from "../../lib/cx.js";

// Colored pill for a shop's lifecycle status. Mirrors the four states allowed by
// the shops.status check constraint (draft / pending / approved / suspended).
const STYLES = {
  draft: "bg-neutral-100 text-neutral-600",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  suspended: "bg-red-100 text-red-700"
};

const LABELS = {
  draft: "Draft",
  pending: "Pending review",
  approved: "Approved",
  suspended: "Suspended"
};

export function ShopStatusBadge({ status, className }) {
  const key = STYLES[status] ? status : "draft";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
        STYLES[key],
        className
      )}
    >
      {LABELS[key]}
    </span>
  );
}
