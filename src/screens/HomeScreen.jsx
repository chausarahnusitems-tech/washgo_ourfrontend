"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { icons, images } from "../assets.js";
import { services as serviceCatalog } from "../data/catalog.js";
import { formatVnd, getPreviousBooking, getShopById, getUpcomingBookings, rankShops } from "../lib/booking.js";
import { useApp } from "../lib/AppContext.jsx";
import { useUrlNav } from "../lib/useUrlNav.js";
import { useIsDesktop } from "../lib/useIsDesktop.js";
import { Icon } from "../components/ui/Icon.jsx";
import { Button } from "../components/ui/Button.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";
import { MapPreview } from "../components/map/MapPreview.jsx";
import { ShopCard } from "../components/ShopCard.jsx";
import { NearbyCard } from "../components/NearbyCard.jsx";
import { BrandLogo } from "../components/vehicle/BrandLogo.jsx";
import { VehicleEditModal } from "../components/vehicle/VehicleEditModal.jsx";
import { brandFromModel } from "../data/carBrands.js";

const homeServiceTiles = [
  { id: "exterior", icon: icons.carwash },
  { id: "interior", icon: icons.interiorCleaning },
  { id: "evCharging", icon: icons.evCharging },
  { id: "detailing", icon: icons.detailing },
  { id: "moreServices", icon: icons.more }
];

export function HomeScreen() {
  const isDesktop = useIsDesktop();
  const { t, state, setLang, auth, catalog } = useApp();
  const { router, searchParams, setParams } = useUrlNav();

  const props = {
    state: { ...state, search: searchParams.get("q") ?? "" },
    // Live, location-aware catalog (haversine distances) — the same source the
    // explore map uses, so home distances match rather than showing seed values.
    allShops: catalog.shops ?? [],
    t,
    isMember: state.selectedPlan === "premium",
    membershipUntil: auth?.profile?.membership_until ?? null,
    onLang: setLang,
    onHome: () => router.push("/"),
    onSearch: (value) => setParams({ q: value }),
    onShop: (id) => router.push(`/explore?shop=${id}`),
    onExplore: () => router.push("/explore"),
    onService: (serviceId) => {
      // Tiles backed by a real catalog service (Car Wash / Interior / Detailing)
      // deep-link to the map's service FILTER (?service=). Tiles with no backing
      // service — EV Charging (no shops offer it yet) and More — just open the
      // full map. NB: the map filters on `service`, not the text query `q`.
      const isService = serviceCatalog.some((service) => service.id === serviceId);
      router.push(isService ? `/explore?service=${encodeURIComponent(serviceId)}` : "/explore");
    },
    // Book a wash = browse and choose a shop. Rebook = repeat the most recent
    // booking's shop (fall back to browse when there's no history).
    onBook: () => router.push("/explore"),
    // Rebook a specific past booking's shop (Previous Booking card).
    onRebookShop: (shopId) => router.push(shopId ? `/shops/${shopId}/book` : "/explore"),
    // Book a specific shop directly (Quick Actions "closest bookable" CTA).
    onBookShop: (shopId) => router.push(`/shops/${shopId}/book`),
    onBookings: () => router.push("/bookings"),
    onPlans: () => router.push("/plans"),
    onTopUp: () => router.push("/topup")
  };

  // Render nothing until the breakpoint is known, so the mobile layout never
  // flashes full-width on desktop (and vice versa).
  if (isDesktop === null) return null;
  return isDesktop ? <HomeDesktop {...props} /> : <HomeMobile {...props} />;
}

/* ------------------------------------------------------------------ */
/* Mobile (original single-column marketplace)                         */
/* ------------------------------------------------------------------ */
function HomeMobile({ state, allShops, t, onLang, onHome, onSearch, onShop, onExplore, onService, onTopUp }) {
  const visibleShops = rankShops(allShops, state.search);

  return (
    <section className="h-full overflow-y-auto px-3.5 pb-5 pt-7">
      <TopBar t={t} lang={state.lang} onLang={onLang} onHome={onHome} />

      <PremiumCareCard t={t} aspectClass="aspect-[345/226]" imageWidthClass="w-[85.5%]" />

      <div className="mt-5 flex items-center gap-2">
        <HomeSearchInput value={state.search} onSearch={onSearch} t={t} />
        <button
          type="button"
          onClick={onExplore}
          aria-label={t("filters")}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500"
        >
          <Icon name="Filter" className="h-5 w-5" />
        </button>
      </div>

      <Link
        href="/claim/new"
        className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-wash-200 bg-wash-50 px-4 py-3 text-sm font-bold text-wash-600"
      >
        <span className="inline-flex items-center gap-2">
          <Icon name="Plus" className="h-4 w-4" />
          Own a car wash? List it on Washgo
        </span>
        <Icon name="ArrowLeft" className="h-4 w-4 rotate-180" />
      </Link>

      <div className="mt-5 flex items-center justify-between">
        <h2 className="font-display text-base font-black">{t("recommended")}</h2>
        <button
          type="button"
          onClick={onTopUp}
          aria-label={t("topUpFunds")}
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-wash-50 px-3 text-xs font-black text-wash-600"
        >
          <Icon name="Wallet" className="h-4 w-4" />
          {formatVnd(state.funds)}
          <Icon name="Plus" className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={onExplore}
        aria-label={t("explore")}
        className="mt-2 block w-full overflow-hidden rounded-[18px] bg-transparent p-0 text-left"
      >
        <MapPreview />
      </button>

      <div className="mt-3 grid gap-3">
        {visibleShops.length ? (
          visibleShops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} t={t} onSelect={onShop} />
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
          <button
            key={service.id}
            type="button"
            onClick={() => onService(service.id)}
            className="grid min-h-[82px] min-w-0 place-items-center content-start gap-0.5 rounded-xl border border-wash-200 bg-white px-1 py-1.5 shadow-sm transition active:border-wash-400"
          >
            <img src={service.icon} alt="" aria-hidden="true" className="h-[52px] w-[52px] max-w-full object-contain" />
            <span className="text-center text-[0.6rem] font-bold leading-tight text-wash-600">{t(service.id)}</span>
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
function HomeDesktop({ state, allShops, t, isMember, membershipUntil, onShop, onExplore, onService, onBook, onRebookShop, onBookShop, onBookings, onPlans }) {
  const nearbyShops = rankShops(allShops, "");
  // Distance for sorting: the live haversine `distanceKm` (added by the context's
  // liveCatalog from the user's location), falling back to parsing the "X.X km"
  // string. Using the live catalog keeps these distances correct and consistent
  // with the explore map.
  const distanceOf = (shop) => {
    if (typeof shop.distanceKm === "number") return shop.distanceKm;
    const parsed = parseFloat(shop.distance);
    return Number.isNaN(parsed) ? Infinity : parsed;
  };
  const byDistance = [...nearbyShops].sort((a, b) => distanceOf(a) - distanceOf(b));
  // Surface the user's actual next upcoming booking (seeded list), not a fake.
  const upcoming = getUpcomingBookings(state.bookings)[0] ?? null;
  // Most recent past booking (completed, cancelled, or an upcoming slot whose
  // time has elapsed) and its catalog shop, for the Previous Booking card.
  // getShopById returns null for a stale/unknown shop id (e.g. backend mode).
  const previous = getPreviousBooking(state.bookings);
  const previousShop = previous ? getShopById(previous.shopId) : null;
  // Quick Actions surfaces the single nearest bookable car wash. It excludes the
  // previous-booking shop (already offered for rebooking in the Previous Booking
  // card) so the two cards never point at the same place; `closestIsNearby` flags
  // the "right next to you" (<1km) case for emphasis.
  const closestBookable =
    byDistance.find((shop) => shop.listingType !== "directory" && shop.id !== previous?.shopId) ?? null;
  const closestIsNearby = closestBookable ? distanceOf(closestBookable) < 1 : false;
  // The "Nearby" rail shows the three closest, but always keep the bookable shop
  // featured in Quick Actions present so the two stay consistent (it can otherwise
  // be pushed out of the top three by directory listings or the rebook shop).
  let closestShops = byDistance.slice(0, 3);
  if (closestBookable && !closestShops.includes(closestBookable)) {
    closestShops = [...byDistance.slice(0, 2), closestBookable];
  }
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const vehicleBrand = state.vehicle.brand || brandFromModel(state.vehicle.model);

  return (
    <>
    <section className="h-full overflow-y-auto bg-mist">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-[320px_1fr] gap-6 px-6 py-7 xl:px-10">
        {/* Left column */}
        <aside className="flex flex-col gap-4">
          <DashCard>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-black">{t("myVehicle")}</h2>
              <button
                type="button"
                onClick={() => setVehicleOpen(true)}
                aria-label={t("editVehicle")}
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-ink"
              >
                <Icon name="Pencil" className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setVehicleOpen(true)}
              className="mt-3 flex w-full items-center gap-3 text-left"
            >
              <BrandLogo brand={vehicleBrand} size={64} />
              <div className="min-w-0">
                <strong className="block truncate font-display text-lg font-black">
                  {state.vehicle.model || t("notSet")}
                </strong>
                <span className="block truncate text-xs text-neutral-500">
                  {t("licensePlateLabel")}: {state.vehicle.plate || "—"}
                </span>
              </div>
            </button>
          </DashCard>

          <DashCard>
            <CardHeader title={t("upcomingBooking")} onClick={upcoming ? onBookings : undefined} />
            {upcoming ? (
              <>
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
              </>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-neutral-500">{t("noUpcoming")}</p>
              </div>
            )}
          </DashCard>

          {previous ? (
            <DashCard>
              <CardHeader title={t("previousBooking")} onClick={onBookings} />
              <div className="mt-3 grid gap-3">
                {/* Rich shop card when the booking's shop is in the live catalog;
                    otherwise fall back to booking fields (backend mode may carry
                    a shopId the catalog doesn't expose). */}
                {previousShop ? (
                  <ShopCard shop={previousShop} t={t} onSelect={onShop} />
                ) : (
                  <button
                    type="button"
                    onClick={() => onShop(previous.shopId)}
                    className="flex items-center gap-3 rounded-[18px] border border-black/10 bg-white p-2 text-left"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-wash-50 text-wash-500">
                      <Icon name="Calendar" className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <strong className="block truncate font-display text-base font-black leading-tight">{previous.shop}</strong>
                      <span className="block text-sm text-neutral-500">
                        {previous.date} <span className="text-neutral-400">·</span> {previous.time}
                      </span>
                    </div>
                  </button>
                )}
                <Button variant="secondary" onClick={() => onRebookShop(previous.shopId)}>
                  <Icon name="RotateCcw" className="h-5 w-5" />
                  {t("rebook")}
                </Button>
              </div>
            </DashCard>
          ) : null}

          <DashCard>
            <CardHeader title={t("quickActions")} />
            <div className="mt-3 grid gap-3">
              {/* The single nearest bookable car wash — always offered as a quick
                  way to get a wash close by, with a badge when it's right nearby. */}
              {closestBookable ? (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-black uppercase tracking-wide text-neutral-500">
                      <Icon name="LocateFixed" className="h-3.5 w-3.5" />
                      {t("closestToYou")}
                    </span>
                    {closestIsNearby ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.62rem] font-black text-emerald-600">
                        {"< 1 km"}
                      </span>
                    ) : null}
                  </div>
                  <ShopCard shop={closestBookable} t={t} onSelect={onShop} />
                  <Button onClick={() => onBookShop(closestBookable.id)}>
                    <Icon name="Car" className="h-5 w-5" />
                    {t("bookWash")}
                  </Button>
                </div>
              ) : null}

              {/* No bookable shop nearby — fall back to a generic browse CTA so the
                  card is never empty. */}
              {!closestBookable ? (
                <Button onClick={onBook}>
                  <Icon name="Car" className="h-5 w-5" />
                  {t("bookWash")}
                </Button>
              ) : null}
            </div>
          </DashCard>

          <button
            type="button"
            onClick={onExplore}
            aria-label={t("explore")}
            className="block w-full bg-transparent p-0 text-left transition hover:opacity-95"
          >
            <MapPreview className="h-48 w-full" />
          </button>
        </aside>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-6">
            <PremiumCareCard t={t} aspectClass="aspect-[2/1]" imageWidthClass="w-[80%]" />

            <section className="relative aspect-[2/1] overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#9c0000,#c40000_60%,#ff5a4a)] p-6 text-white">
              {/* Decorative papercut artwork, full-bleed on the right. */}
              <img
                src={images.membershipBg}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right"
              />
              {/* Red wash fading left→right keeps the title / CTA readable over it. */}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#9c0000_0%,rgba(156,0,0,0.65)_40%,rgba(156,0,0,0)_72%)]" />
              <div className="relative z-10">
                {isMember ? (
                  <>
                    <h2 className="font-display text-2xl font-black">{t("proMember")}</h2>
                    <p className="mt-3 text-sm text-white/90">
                      {t("memberActiveUntil")}
                      <br />
                      <strong>{membershipUntil || t("active")}</strong>
                    </p>
                    <p className="mt-3 text-sm text-white/90">{t("unlimitedWashes")}</p>
                  </>
                ) : (
                  <>
                    <h2 className="font-display text-2xl font-black">{t("washgoMembership")}</h2>
                    <p className="mt-3 text-sm text-white/90">{t("membershipPitch")}</p>
                    <button type="button" onClick={onPlans} className="mt-4 inline-flex rounded-full bg-white/90 px-4 py-1.5 text-sm font-black text-wash-600">
                      {t("joinMembership")}
                    </button>
                  </>
                )}
              </div>
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
              {closestShops.map((shop) => (
                <NearbyCard key={shop.id} shop={shop} t={t} onSelect={onShop} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-black">{t("services")}</h2>
            <div className="mt-3 grid grid-cols-5 gap-4">
              {homeServiceTiles.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onService(service.id)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-wash-200 bg-white px-2 py-5 shadow-sm transition hover:border-wash-400 hover:shadow-md"
                >
                  <img src={service.icon} alt="" aria-hidden="true" className="h-14 w-14 object-contain" />
                  <span className="text-center text-xs font-bold text-wash-600">{t(service.id)}</span>
                </button>
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
    <VehicleEditModal open={vehicleOpen} onClose={() => setVehicleOpen(false)} />
    </>
  );
}

/* Shared "Premium Care for Your Car" hero card.
   Text is sized in container query units (cqw) — a percentage of the card's own
   width — so the title/body stay at the exact same scale relative to the card on
   every screen size. Only the aspect ratio and image width differ per layout. */
function PremiumCareCard({ t, aspectClass, imageWidthClass }) {
  return (
    <section
      className={`relative ${aspectClass} overflow-hidden rounded-[20px] bg-[linear-gradient(301deg,#ff0000_0%,#760000_22.6%,#ff0000_48.6%,#9c0000_88.5%)] [container-type:inline-size]`}
    >
      <img
        src={icons.premiumCareForCar}
        alt=""
        aria-hidden="true"
        className={`absolute inset-y-0 right-0 h-full ${imageWidthClass} object-cover object-right`}
      />
      <div className="absolute left-[7%] top-[14%] w-[50%] text-white">
        <h1 className="font-display text-[6.5cqw] font-black leading-tight">{t("heroTitle")}</h1>
        <p className="mt-[2.5cqw] text-[3cqw] leading-snug text-white/90">{t("heroCopy")}</p>
      </div>
    </section>
  );
}

// Home search box with LOCAL input state + a debounced URL write, so typing stays
// responsive instead of replacing the route (and re-ranking) on every keystroke.
// The URL `value` stays the source of truth: we re-sync the input when it changes
// externally (back button / cleared) and commit immediately on Enter.
function HomeSearchInput({ value, onSearch, t }) {
  const [draft, setDraft] = useState(value);
  const timerRef = useRef(null);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const onDraftChange = (next) => {
    setDraft(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearch(next), 250);
  };

  return (
    <label className="grid min-h-12 flex-1 grid-cols-[auto_1fr] items-center gap-3 rounded-full bg-neutral-100 px-4 text-neutral-500">
      <Icon name="Search" className="h-5 w-5" />
      <input
        type="search"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            clearTimeout(timerRef.current);
            onSearch(event.currentTarget.value);
          }
        }}
        placeholder={t("searchPlaceholder")}
        className="min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
      />
    </label>
  );
}

function DashCard({ children }) {
  return <div className="rounded-2xl border border-black/10 bg-white p-4">{children}</div>;
}

function CardHeader({ title, onClick }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-display text-base font-black">{title}</h2>
      {onClick ? (
        <button type="button" onClick={onClick} className="bg-transparent p-0 text-neutral-400">
          <Icon name="ChevronRight" className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}
