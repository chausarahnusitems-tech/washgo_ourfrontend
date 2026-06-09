import { icons, images } from "../assets.js";
import { getVisibleShops } from "../lib/booking.js";
import { useIsDesktop } from "../lib/useIsDesktop.js";
import { Icon } from "../components/ui/Icon.jsx";
import { Button } from "../components/ui/Button.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";
import { MapPreview } from "../components/map/MapPreview.jsx";
import { MapPlaceholder } from "../components/map/MapPlaceholder.jsx";
import { ShopCard } from "../components/ShopCard.jsx";
import { NearbyCard } from "../components/NearbyCard.jsx";

const homeServiceTiles = [
  { id: "exterior", icon: icons.carwash },
  { id: "interior", icon: icons.interiorCleaning },
  { id: "evCharging", icon: icons.evCharging },
  { id: "detailing", icon: icons.detailing },
  { id: "moreServices", icon: icons.more }
];

export function HomeScreen(props) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <HomeDesktop {...props} /> : <HomeMobile {...props} />;
}

/* ------------------------------------------------------------------ */
/* Mobile (original single-column marketplace)                         */
/* ------------------------------------------------------------------ */
function HomeMobile({ state, t, onLang, onHome, onSearch, onShop, onQuickView }) {
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

/* ------------------------------------------------------------------ */
/* Desktop dashboard (image 1)                                         */
/* ------------------------------------------------------------------ */
function HomeDesktop({ state, t, onShop, onExplore, onBook, onBookings }) {
  const nearbyShops = getVisibleShops("");
  const upcoming = state.booking ?? { shop: "MWW 1234", date: "Jul 6, 2026", time: "2:00 PM" };

  return (
    <section className="h-full overflow-y-auto bg-mist">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-[320px_1fr] gap-6 px-6 py-7 xl:px-10">
        {/* Left column */}
        <aside className="flex flex-col gap-4">
          <DashCard>
            <CardHeader title={t("myVehicle")} />
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-100">
                <img src={images.car} alt="" className="h-full w-full object-contain p-1" />
              </div>
              <div className="min-w-0 text-right">
                <strong className="block truncate font-display text-lg font-black">{state.vehicle.model}</strong>
                <span className="block text-xs text-neutral-500">
                  {t("licensePlateLabel")}: {state.vehicle.plate}
                </span>
              </div>
            </div>
          </DashCard>

          <DashCard>
            <CardHeader title={t("upcomingBooking")} onClick={onBookings} />
            <div className="mt-3 flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-wash-50 text-wash-500">
                <Icon name="Calendar" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <strong className="block">
                  {upcoming.date} <span className="text-neutral-400">·</span> {upcoming.time}
                </strong>
                <span className="block truncate text-sm text-neutral-500">{upcoming.shop}</span>
              </div>
            </div>
            <hr className="my-3 border-black/10" />
            <button type="button" onClick={onBookings} className="bg-transparent p-0 text-sm font-black text-wash-500">
              {t("viewDetails")}
            </button>
          </DashCard>

          <DashCard>
            <CardHeader title={t("quickActions")} />
            <div className="mt-3 grid gap-3">
              <Button onClick={onBook}>
                <Icon name="Car" className="h-5 w-5" />
                {t("bookWash")}
              </Button>
              <Button variant="secondary" onClick={onBook}>
                <Icon name="RotateCcw" className="h-5 w-5" />
                {t("rebook")}
              </Button>
            </div>
          </DashCard>

          <MapPlaceholder className="h-48 w-full" />
        </aside>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-6">
            <section className="relative aspect-[2/1] overflow-hidden rounded-[20px] bg-[linear-gradient(301deg,#ff0000_0%,#760000_22.6%,#ff0000_48.6%,#9c0000_88.5%)]">
              <img
                src={icons.premiumCareForCar}
                alt=""
                aria-hidden="true"
                className="absolute inset-y-0 right-0 h-full w-[80%] object-fill"
              />
              <div className="absolute left-[7%] top-[14%] w-[52%] text-white">
                <h1 className="font-display text-3xl font-black leading-tight">{t("heroTitle")}</h1>
                <p className="mt-3 text-sm leading-snug text-white/90">{t("heroCopy")}</p>
              </div>
            </section>

            <section className="relative aspect-[2/1] overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.28),transparent_30%),linear-gradient(135deg,#9c0000,#c40000_60%,#ff5a4a)] p-6 text-white">
              <h2 className="font-display text-2xl font-black">{t("proMember")}</h2>
              <p className="mt-3 text-sm text-white/90">
                {t("renewOn")}
                <br />
                <strong>{t("dateUntil")}</strong>
              </p>
              <p className="mt-3 text-sm text-white/90">{t("unlimitedWashes")}</p>
            </section>
          </div>

          <section>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-black">{t("nearbyCarWashes")}</h2>
              <button type="button" onClick={onExplore} className="bg-transparent p-0 text-sm font-black text-wash-500">
                {t("viewAll")}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4">
              {nearbyShops.map((shop, index) => (
                <NearbyCard key={shop.id} shop={shop} t={t} onSelect={onShop} closed={index === 2} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-black">{t("services")}</h2>
            <div className="mt-3 grid grid-cols-5 gap-4">
              {homeServiceTiles.map((service) => (
                <div
                  key={service.id}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-wash-50 px-2 py-5"
                >
                  <img src={service.icon} alt="" aria-hidden="true" className="h-14 w-14 object-contain" />
                  <span className="text-center text-xs font-semibold text-ink">{t(service.id)}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-black">{t("recommended")}</h2>
            <div className="mt-3 grid grid-cols-3 gap-4">
              {nearbyShops.map((shop) => (
                <NearbyCard key={`rec-${shop.id}`} shop={shop} t={t} onSelect={onShop} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function DashCard({ children }) {
  return <div className="rounded-2xl border border-black/10 bg-white p-4">{children}</div>;
}

function CardHeader({ title, onClick }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-display text-base font-black">{title}</h2>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="bg-transparent p-0 text-neutral-400 disabled:opacity-60"
        aria-hidden={!onClick}
      >
        <Icon name="ChevronRight" className="h-5 w-5" />
      </button>
    </div>
  );
}
