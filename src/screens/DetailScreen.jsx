import { images } from "../assets.js";
import { services } from "../data/catalog.js";
import { getVisibleShops } from "../lib/booking.js";
import { useIsDesktop } from "../lib/useIsDesktop.js";
import { Icon } from "../components/ui/Icon.jsx";
import { Button, IconButton } from "../components/ui/Button.jsx";
import { MapPreview } from "../components/map/MapPreview.jsx";
import { MapPlaceholder } from "../components/map/MapPlaceholder.jsx";
import { ShopCard } from "../components/ShopCard.jsx";
import { SearchBar, FilterChips } from "./ExploreScreen.jsx";

function ServiceChips({ shop, t }) {
  return (
    <div className="flex flex-wrap gap-2">
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
  );
}

export function DetailScreen(props) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DetailDesktop {...props} /> : <DetailMobile {...props} />;
}

/* ------------------------------------------------------------------ */
/* Mobile (original)                                                   */
/* ------------------------------------------------------------------ */
function DetailMobile({ shop, t, onBack, onBooking, onQuickView }) {
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
          <div className="mt-3">
            <ServiceChips shop={shop} t={t} />
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

/* ------------------------------------------------------------------ */
/* Desktop: explore split with a floating detail card (image 3)        */
/* ------------------------------------------------------------------ */
function DetailDesktop({ shop, state, t, onBooking, onQuickView, onShop, onSearch }) {
  const visibleShops = getVisibleShops(state?.search ?? "");

  return (
    <section className="flex h-full">
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-black/10 bg-white">
        <div className="grid gap-3 border-b border-black/10 px-4 py-4">
          <SearchBar value={state?.search ?? ""} onChange={onSearch} t={t} />
          <FilterChips t={t} />
        </div>
        <div className="grid gap-3 overflow-y-auto px-4 py-4">
          {visibleShops.map((item) => (
            <ShopCard key={item.id} shop={item} t={t} onSelect={onShop} onQuickView={onQuickView} />
          ))}
        </div>
      </aside>

      <div className="relative min-w-0 flex-1">
        <MapPlaceholder className="h-full w-full" rounded="rounded-none" label={shop.name} />

        {/* Floating detail card */}
        <article className="absolute left-1/2 top-1/2 w-[420px] max-w-[calc(100%-3rem)] -translate-x-1/2 -translate-y-1/2 rounded-[22px] bg-white p-5 shadow-device">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-black leading-tight">{shop.name}</h1>
              <p className="mt-1 text-sm text-neutral-600">
                {t("hours")} · {shop.distance}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-neutral-600">
                <Icon name="MapPin" className="h-4 w-4 shrink-0" />
                {shop.address}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <IconButton label="Share" className="h-9 w-9">
                <Icon name="Share2" className="h-5 w-5" />
              </IconButton>
              <IconButton label={t("quickView")} onClick={() => onQuickView(shop.id)} className="h-9 w-9">
                <Icon name="Heart" className="h-5 w-5" />
              </IconButton>
            </div>
          </div>

          <img src={images.hero} alt={shop.name} className="mt-4 h-48 w-full rounded-xl object-cover object-[58%_center]" />

          <h2 className="mt-4 font-display text-sm font-black text-neutral-600">{t("serviceIncluded")}</h2>
          <div className="mt-2">
            <ServiceChips shop={shop} t={t} />
          </div>
          <button type="button" onClick={onBooking} className="mt-3 inline-flex items-center gap-1 bg-transparent p-0 font-black text-wash-500">
            {t("showMore")}
            <Icon name="ChevronDown" className="h-4 w-4" />
          </button>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <strong className="block text-2xl font-black leading-none">{shop.starting} {t("tokens")}</strong>
              <span className="text-xs text-neutral-500">{t("startingAt")}</span>
            </div>
            <Button onClick={onBooking} className="px-8">{t("bookNow")}</Button>
          </div>
        </article>
      </div>
    </section>
  );
}
