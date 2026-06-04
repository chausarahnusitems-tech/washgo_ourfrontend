import { icons } from "../assets.js";
import { getVisibleShops } from "../lib/booking.js";
import { Icon } from "../components/ui/Icon.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";
import { MapPreview } from "../components/map/MapPreview.jsx";
import { ShopCard } from "../components/ShopCard.jsx";

const homeServiceTiles = [
  { id: "exterior", icon: icons.carwash },
  { id: "interior", icon: icons.interiorCleaning },
  { id: "evCharging", icon: icons.evCharging },
  { id: "detailing", icon: icons.detailing },
  { id: "moreServices", icon: icons.more }
];

export function HomeScreen({ state, t, onLang, onHome, onSearch, onShop, onQuickView }) {
  const visibleShops = getVisibleShops(state.search);

  return (
    <section className="h-full overflow-y-auto px-3.5 pb-5 pt-7">
      <TopBar t={t} lang={state.lang} onLang={onLang} onHome={onHome} />

      <section className="relative aspect-[345/226] overflow-hidden rounded-[20px] bg-[linear-gradient(301deg,#ff0000_0%,#760000_22.6%,#ff0000_48.6%,#9c0000_88.5%)]">
        <img
          src={icons.premiumCareForCar}
          alt=""
          aria-hidden="true"
          className="absolute inset-y-0 right-0 h-full w-[85.5%] object-fill"
        />
        <div className="absolute left-[9.3%] top-[13.7%] w-[48%] text-white">
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
        {homeServiceTiles.map((service) => (
          <button key={service.id} type="button" className="grid min-h-[82px] min-w-0 place-items-center content-start gap-1 rounded-xl bg-transparent px-0 py-0">
            <img src={service.icon} alt="" aria-hidden="true" className="h-[60px] w-[60px] max-w-full object-contain" />
            <span className="text-center text-[0.6rem] leading-tight text-ink">{t(service.id)}</span>
          </button>
        ))}
      </div>

      <section className="relative mt-5 min-h-[132px] overflow-hidden rounded-[20px] bg-wash-50">
        <div className="relative z-10 w-[46%] px-5 py-5">
          <h2 className="font-display text-xl font-black">{t("promoTitle")}</h2>
          <p className="mt-2 text-sm leading-snug">{t("promoCopy")}</p>
        </div>
        <img
          src={icons.farFromHome}
          alt=""
          aria-hidden="true"
          className="absolute inset-y-0 right-0 h-full w-[62%] object-cover object-right"
        />
        <div className="absolute inset-y-0 left-[35%] z-[1] w-16 bg-[linear-gradient(90deg,#fff0ee_0%,rgba(255,240,238,0)_100%)]" />
      </section>
    </section>
  );
}
