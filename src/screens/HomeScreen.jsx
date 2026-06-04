import { images } from "../assets.js";
import { services } from "../data/catalog.js";
import { getVisibleShops } from "../lib/booking.js";
import { Icon } from "../components/ui/Icon.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";
import { MapPreview } from "../components/map/MapPreview.jsx";
import { ShopCard } from "../components/ShopCard.jsx";

const serviceTone = {
  exterior: "bg-wash-50 text-wash-500",
  interior: "bg-emerald-50 text-emerald-600",
  detailing: "bg-amber-50 text-amber-600",
  wax: "bg-slate-100 text-slate-700"
};

export function HomeScreen({ state, t, onLang, onHome, onSearch, onShop, onQuickView }) {
  const visibleShops = getVisibleShops(state.search);

  return (
    <section className="h-full overflow-y-auto px-3.5 pb-5 pt-7">
      <TopBar t={t} lang={state.lang} onLang={onLang} onHome={onHome} />

      <section className="relative h-[226px] overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#c40000,#ff1d12_58%,#ff6a5d)]">
        <img src={images.hero} alt="A red car being washed" className="absolute inset-y-0 right-0 h-full w-[84%] object-cover object-[86%_center]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(196,0,0,0.98)_0%,rgba(224,16,8,0.72)_42%,rgba(224,16,8,0.05)_76%)]" />
        <div className="absolute left-7 top-7 w-[48%] text-white">
          <h1 className="font-display text-2xl font-black leading-tight">{t("heroTitle")}</h1>
          <p className="mt-3 text-sm leading-snug text-white/90">{t("heroCopy")}</p>
        </div>
      </section>

      <label className="mt-5 grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-full bg-neutral-100 px-4 text-neutral-500">
        <Icon name="Search" className="h-5 w-5" />
        <input
          type="search"
          value={state.search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
        />
        <Icon name="Filter" className="h-5 w-5" />
      </label>

      <div className="mt-5 flex items-center justify-between">
        <h2 className="font-display text-base font-black">{t("recommended")}</h2>
        <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-wash-50 px-3 text-xs font-black text-wash-600">
          <Icon name="Coins" className="h-4 w-4" />
          {state.tokens} {t("tokenShort")}
        </span>
      </div>
      <div className="mt-2">
        <MapPreview />
      </div>

      <div className="mt-3 grid gap-3">
        {visibleShops.length ? (
          visibleShops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} t={t} onSelect={onShop} onQuickView={onQuickView} />
          ))
        ) : (
          <div className="rounded-[18px] border border-black/10 bg-white p-7 text-center text-sm text-neutral-500">{t("noResults")}</div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-display text-base font-black">{t("services")}</h2>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {services.map((service) => (
          <button key={service.id} type="button" className={`grid min-h-[72px] place-items-center rounded-xl px-1 py-2 ${serviceTone[service.id]}`}>
            <Icon name={service.icon} className="h-6 w-6" />
            <span className="text-center text-[0.6rem] leading-tight text-ink">{t(service.id)}</span>
          </button>
        ))}
        <button type="button" className="grid min-h-[72px] place-items-center rounded-xl bg-neutral-100 px-1 py-2 text-ink">
          <Icon name="Filter" className="h-6 w-6" />
          <span className="text-center text-[0.6rem] leading-tight">{t("moreServices")}</span>
        </button>
      </div>

      <section className="mt-5 grid min-h-[132px] grid-cols-[1fr_112px] items-center overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#fff0ee,#ffe2df)] p-5">
        <div>
          <h2 className="font-display text-xl font-black">{t("promoTitle")}</h2>
          <p className="mt-2 text-sm leading-snug">{t("promoCopy")}</p>
        </div>
        <div className="grid h-24 place-items-center rounded-full bg-[linear-gradient(135deg,#ffdbd7,#ef3124)] text-wash-500">
          <Icon name="Car" className="h-12 w-12 text-white" />
        </div>
      </section>
    </section>
  );
}
