import { images } from "../assets.js";
import { services } from "../data/catalog.js";
import { Icon } from "../components/ui/Icon.jsx";
import { Button, IconButton } from "../components/ui/Button.jsx";
import { MapPreview } from "../components/map/MapPreview.jsx";

export function DetailScreen({ shop, t, onBack, onBooking, onQuickView }) {
  return (
    <>
      <section className="h-full overflow-y-auto bg-white">
        <div className="relative">
          <MapPreview large />
          <IconButton label="Back" onClick={onBack} className="absolute left-5 top-5 bg-white/85 backdrop-blur">
            <Icon name="ArrowLeft" className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="relative z-10 -mt-8 rounded-t-[28px] bg-white px-6 pb-6 pt-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-black leading-tight">{shop.name}</h1>
              <p className="mt-2 text-sm text-neutral-600">
                {t("hours")} · {shop.distance}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-neutral-600">
                <Icon name="MapPin" className="h-4 w-4" />
                {shop.address}
              </p>
            </div>
            <div className="flex gap-2">
              <IconButton label="Share" className="h-9 w-9">
                <Icon name="Share2" className="h-5 w-5" />
              </IconButton>
              <IconButton label={t("quickView")} onClick={() => onQuickView(shop.id)} className="h-9 w-9">
                <Icon name="Heart" className="h-5 w-5" />
              </IconButton>
            </div>
          </div>

          <img src={images.hero} alt={shop.name} className="mt-5 h-64 w-full rounded-xl object-cover object-[58%_center]" />

          <h2 className="mt-5 font-display text-base font-black text-neutral-600">{t("serviceIncluded")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {shop.services.map((id) => {
              const service = services.find((item) => item.id === id);
              return (
                <span key={id} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-neutral-100 px-3 text-xs font-bold text-neutral-600">
                  <Icon name={service?.icon ?? "Car"} className="h-4 w-4" />
                  {t(id)}
                </span>
              );
            })}
          </div>
          <button type="button" onClick={onBooking} className="mx-auto mt-3 block min-h-10 bg-transparent font-black text-wash-500">
            {t("showMore")}
          </button>
        </div>
      </section>
      <footer className="grid h-[92px] grid-cols-[88px_1fr] items-center gap-4 border-t border-black/20 bg-white px-6 py-4">
        <div className="grid grid-cols-[auto_1fr] items-end gap-1">
          <strong className="text-3xl font-black leading-none">{shop.starting}</strong>
          <span className="text-xs text-neutral-500">
            {t("tokens")}
            <br />
            {t("startingAt")}
          </span>
        </div>
        <Button onClick={onBooking}>{t("bookNow")}</Button>
      </footer>
    </>
  );
}
