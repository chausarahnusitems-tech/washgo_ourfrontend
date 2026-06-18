import { images } from "../../assets.js";
import { formatVnd, getBookingStatus } from "../../lib/booking.js";
import { Icon } from "../../components/ui/Icon.jsx";

const statusTones = {
  upcoming: "bg-wash-50 text-wash-600",
  completed: "bg-emerald-50 text-emerald-600",
  cancelled: "bg-neutral-100 text-neutral-500"
};

// Renders a booking summary. Pass `onClick` to make the whole card a button that
// opens the booking detail page (adds a chevron affordance); omit it for a
// static summary (e.g. on the confirmation screen).
export function BookingCard({ booking, shop, t, onClick }) {
  const status = getBookingStatus(booking);
  const statusLabel = {
    upcoming: t("statusUpcoming"),
    completed: t("statusCompleted"),
    cancelled: t("statusCancelled")
  }[status];

  const className = `grid w-full grid-cols-[84px_1fr_auto] items-center gap-3 rounded-xl border border-black/20 bg-white p-3 text-left ${
    onClick ? "transition hover:border-wash-300 hover:shadow-sm" : ""
  }`;

  const inner = (
    <>
      <img
        src={shop.imageUrl || images.hero}
        alt={shop.name}
        className={`h-[84px] w-[84px] rounded-xl object-cover ${shop.imageUrl ? "object-center" : "object-[58%_center]"}`}
      />
      <div className="min-w-0">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wide ${statusTones[status]}`}>
          {statusLabel}
        </span>
        <h2 className="mt-1 truncate font-display text-base font-black">{booking.shop}</h2>
        <p className="mt-1 text-sm text-neutral-600">{booking.date} · {booking.time}</p>
        <strong className="mt-1 block text-wash-500">{formatVnd(booking.total)}</strong>
      </div>
      {onClick ? <Icon name="ChevronRight" className="h-5 w-5 text-neutral-400" /> : <span />}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={() => onClick(booking.id)} className={className}>
        {inner}
      </button>
    );
  }

  return <article className={className}>{inner}</article>;
}
