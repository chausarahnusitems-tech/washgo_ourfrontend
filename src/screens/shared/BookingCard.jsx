import { images } from "../../assets.js";
import { formatVnd } from "../../lib/booking.js";

export function BookingCard({ booking, shop, t }) {
  return (
    <article className="grid grid-cols-[92px_1fr] gap-3 rounded-xl border border-black/20 bg-white p-3 text-left">
      <img src={images.hero} alt={shop.name} className="h-[92px] w-[92px] rounded-xl object-cover object-[58%_center]" />
      <div className="min-w-0">
        <h2 className="mt-1 truncate font-display text-base font-black">{booking.shop}</h2>
        <p className="mt-2 text-sm text-neutral-600">{booking.date} · {booking.time}</p>
        <strong className="mt-1 block text-wash-500">{formatVnd(booking.total)}</strong>
      </div>
    </article>
  );
}
