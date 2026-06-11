import { images } from "../assets.js";
import { services as serviceCatalog } from "../data/catalog.js";
import { formatVnd } from "../lib/booking.js";
import { Icon } from "./ui/Icon.jsx";

export function NearbyCard({ shop, t, onSelect }) {
  const closed = !shop.open;
  const shopServices = shop.services
    .map((id) => serviceCatalog.find((service) => service.id === id))
    .filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => onSelect(shop.id)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative h-32 w-full overflow-hidden bg-neutral-100">
        <img src={images.hero} alt={`${shop.name} ${t("washBayAlt")}`} className={`h-full w-full object-cover ${shop.imagePosition}`} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <h3 className="truncate font-display text-base font-black leading-tight text-ink">{shop.name}</h3>
        <div className="flex items-center gap-1 text-[0.72rem] text-wash-500">
          <Icon name="Star" className="h-3.5 w-3.5" />
          <span className="font-bold">{shop.rating}</span>
          <span className="text-neutral-500">({shop.reviews})</span>
        </div>
        <p className="flex flex-wrap items-center gap-1 text-[0.7rem] text-neutral-500">
          <span
            className={`rounded px-1 text-[0.6rem] font-black text-white ${closed ? "bg-neutral-400" : "bg-emerald-500"}`}
          >
            {closed ? t("closed") : t("open")}
          </span>
          <span>· {shop.hours ?? t("hours")}</span>
        </p>
        <p className="truncate text-[0.7rem] text-neutral-500">{shop.address}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-xs font-black text-ink">
            {t("from")} {formatVnd(shop.starting)}
          </span>
          <span className="flex items-center gap-1 text-neutral-400">
            {shopServices.slice(0, 3).map((service) => (
              <Icon key={service.id} name={service.icon} className="h-3.5 w-3.5" />
            ))}
            <span className="ml-1 text-[0.7rem] text-neutral-500">{shop.distance}</span>
          </span>
        </div>
      </div>
    </button>
  );
}
