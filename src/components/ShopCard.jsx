import { images } from "../assets.js";
import { Icon } from "./ui/Icon.jsx";
import { IconButton } from "./ui/Button.jsx";

export function ShopCard({ shop, t, onSelect, onQuickView }) {
  return (
    <article className="grid grid-cols-[84px_1fr] gap-3 rounded-[18px] border border-black/10 bg-white p-2">
      <button
        type="button"
        onClick={() => onSelect(shop.id)}
        className="relative h-[84px] overflow-hidden rounded-xl bg-neutral-100"
      >
        <img src={images.hero} alt={`${shop.name} wash bay`} className={`h-full w-full object-cover ${shop.imagePosition}`} />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-wash-500 px-2 py-1 text-[0.56rem] font-black text-white">
          {t("freeWash")}
        </span>
      </button>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelect(shop.id)}
            className="min-h-7 min-w-0 bg-transparent p-0 text-left font-display text-base font-black leading-tight text-ink"
          >
            {shop.name}
          </button>
          <IconButton label={t("quickView")} onClick={() => onQuickView(shop.id)} className="h-9 w-9">
            <Icon name="Heart" className="h-5 w-5" />
          </IconButton>
        </div>
        <p className="mt-1 text-xs text-neutral-600">
          <span className="rounded bg-emerald-500 px-1 text-[0.62rem] font-black text-white">{t("open")}</span>
          {" · "}
          {t("hours")} · {shop.distance}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.7rem] text-wash-500">
          <span className="inline-flex items-center gap-1">
            <Icon name="Star" className="h-3.5 w-3.5" />
            {shop.rating} ({shop.reviews})
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="Clock" className="h-3.5 w-3.5" />
            {shop.wait}
          </span>
          <strong className="text-ink">
            {shop.starting} {t("tokenShort")}
          </strong>
        </div>
      </div>
    </article>
  );
}
