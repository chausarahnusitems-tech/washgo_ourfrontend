"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { userLocation } from "../data/catalog.js";
import { useGeolocation } from "../lib/useGeolocation.js";
import { getBestShopMatch, rankShops, sortByPartnerThenDistance } from "../lib/booking.js";
import { isShopOpenNow } from "../lib/hours.js";
import { useApp } from "../lib/AppContext.jsx";
import { useUrlNav } from "../lib/useUrlNav.js";
import { useIsDesktop } from "../lib/useIsDesktop.js";
import { Icon } from "../components/ui/Icon.jsx";
import { IconButton } from "../components/ui/Button.jsx";
import { InteractiveMap } from "../components/map/InteractiveMapDynamic.jsx";
import { ShopCard } from "../components/ShopCard.jsx";
import { ShopDetailCard } from "../components/ShopDetailCard.jsx";
import { BottomSheet } from "../components/ui/BottomSheet.jsx";

export function SearchBar({ value, onChange, t, activeFav, onToggleFav }) {
  // Local input state keeps typing responsive: the heavy URL write (route replace
  // + re-rank) is debounced (~250ms) or committed on Enter, rather than firing on
  // every keystroke. The URL `value` stays the source of truth — we re-sync the
  // input when it changes externally (e.g. cleared / back button / deep link).
  const [draft, setDraft] = useState(value);
  const timerRef = useRef(null);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const commit = (next) => {
    clearTimeout(timerRef.current);
    onChange(next);
  };
  const onDraftChange = (next) => {
    setDraft(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(next), 250);
  };

  return (
    <div className="flex min-h-12 items-center gap-2 rounded-full bg-neutral-100 pl-4 pr-1.5 text-neutral-500">
      <label className="flex min-w-0 flex-1 items-center gap-3">
        <Icon name="Search" className="h-5 w-5 shrink-0" />
        <input
          type="search"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit(event.currentTarget.value);
          }}
          placeholder={t("searchPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
        />
      </label>
      {onToggleFav ? (
        <button
          type="button"
          aria-pressed={activeFav}
          aria-label={t("favourites")}
          title={t("favourites")}
          onClick={onToggleFav}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${
            activeFav ? "bg-wash-50 text-wash-500" : "text-neutral-400 hover:text-wash-500"
          }`}
        >
          <Icon name="Heart" className={`h-5 w-5 ${activeFav ? "fill-wash-500" : ""}`} />
        </button>
      ) : null}
    </div>
  );
}

// Quick filters that narrow the shop set. Only "Open now" and a price cap are wired
// up for now (more to come); each is an independent toggle persisted in the URL.
export function FilterChips({ t, openNow, underPrice, onToggleOpenNow, onToggleUnderPrice }) {
  const chips = [
    { key: "open", icon: "Clock", label: t("filterOpenNow"), active: openNow, onToggle: onToggleOpenNow },
    { key: "price", icon: "Coins", label: t("filterUnder100k"), active: underPrice, onToggle: onToggleUnderPrice }
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-pressed={chip.active}
          onClick={chip.onToggle}
          className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold transition ${
            chip.active ? "bg-wash-500 text-white" : "border border-black/10 bg-white text-ink"
          }`}
        >
          <Icon name={chip.icon} className="h-4 w-4" />
          {chip.label}
        </button>
      ))}
    </div>
  );
}

export function ExploreScreen() {
  const isDesktop = useIsDesktop();
  const { t, state, catalog } = useApp();
  const { router, searchParams, setParams } = useUrlNav();

  // Live reference catalog (DB-backed in backend mode, seed in demo). Guard for
  // it being empty on the first paint before the DB fetch resolves.
  const allShops = catalog.shops ?? [];

  const search = searchParams.get("q") ?? "";
  const openNow = searchParams.get("open") === "1";
  const maxPriceParam = searchParams.get("maxprice");
  const maxPrice = maxPriceParam ? Number(maxPriceParam) : null;
  const activeFav = searchParams.get("fav") === "1";

  const props = {
    state: {
      ...state,
      search,
      mapShop: searchParams.get("shop") ?? null,
      openNow,
      maxPrice,
      activeFav
    },
    allShops,
    t,
    onHome: () => router.push("/"),
    onSearch: (value) => setParams({ q: value }),
    onToggleOpenNow: () => setParams({ open: openNow ? null : "1" }),
    onToggleUnderPrice: () => setParams({ maxprice: maxPrice != null ? null : "100000" }),
    onToggleFav: () => setParams({ fav: activeFav ? null : "1" }),
    onSelectMapShop: (id) => setParams({ shop: id }),
    onCloseMapShop: () => setParams({ shop: null }),
    onBook: (id) => router.push(`/shops/${id}/book`)
  };

  // Render nothing until the breakpoint is known, so neither layout flashes.
  if (isDesktop === null) return null;
  return isDesktop ? <ExploreDesktop {...props} /> : <ExploreMobile {...props} />;
}

/* ------------------------------------------------------------------ */
/* Desktop: persistent sidebar list + map; detail card floats next to  */
/* the list (images 1 & 2).                                            */
/* ------------------------------------------------------------------ */
function ExploreDesktop({ state, allShops, t, onSearch, onToggleOpenNow, onToggleUnderPrice, onToggleFav, onSelectMapShop, onCloseMapShop, onBook }) {
  // MAP set: filtered ONLY by the quick-filter chips + favourites toggle — NOT the
  // text query — so typing re-centers the map instead of making non-matching pins
  // vanish. `allShops` is in the deps so this recomputes when the DB catalog
  // arrives after first paint. `now` anchors the "open now" check to page load.
  const [now] = useState(() => new Date());
  const mapShops = useMemo(() => {
    let result = allShops;
    if (state.openNow) {
      result = result.filter((s) => {
        const open = isShopOpenNow(s, now);
        return open === null ? s.open : open; // unknown hours → stored flag
      });
    }
    if (state.maxPrice != null) {
      result = result.filter((s) => s.starting > 0 && s.starting < state.maxPrice);
    }
    if (state.activeFav) {
      result = result.filter((s) => (state.favorites ?? []).includes(s.id));
    }
    return result;
  }, [state.openNow, state.maxPrice, state.activeFav, state.favorites, allShops, now]);
  // LIST set: when searching, the elastic/typo-tolerant ranked results for the
  // sidebar; otherwise the default browse order — partners first, then nearest.
  const listShops = useMemo(
    () => (state.search ? rankShops(mapShops, state.search, null) : sortByPartnerThenDistance(mapShops)),
    [mapShops, state.search]
  );
  // Re-center the map on the single best text match (without selecting it).
  const bestMatchId = useMemo(
    () => (state.search ? getBestShopMatch(mapShops, state.search, null) : null),
    [mapShops, state.search]
  );
  const liveLocation = useGeolocation(userLocation);
  const selectedShop = allShops.find((shop) => shop.id === state.mapShop) ?? null;

  return (
    <section className="flex h-full">
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-black/10 bg-white">
        <div className="grid gap-3 border-b border-black/10 px-4 py-4">
          <SearchBar value={state.search} onChange={onSearch} t={t} activeFav={state.activeFav} onToggleFav={onToggleFav} />
          <FilterChips t={t} openNow={state.openNow} underPrice={state.maxPrice != null} onToggleOpenNow={onToggleOpenNow} onToggleUnderPrice={onToggleUnderPrice} />
        </div>
        <div className="grid gap-3 overflow-y-auto px-4 py-4">
          {listShops.length ? (
            listShops.map((shop) => (
              <ShopCard
                key={shop.id}
                shop={shop}
                t={t}
                onSelect={onSelectMapShop}
                active={shop.id === state.mapShop}
              />
            ))
          ) : (
            <div className="rounded-[18px] border border-black/10 bg-white p-7 text-center text-sm text-neutral-500">{t("noResults")}</div>
          )}
        </div>
      </aside>

      <div className="relative isolate min-w-0 flex-1">
        <InteractiveMap
          className="h-full w-full"
          shops={mapShops}
          selectedId={state.mapShop}
          focusShopId={bestMatchId}
          onSelectShop={onSelectMapShop}
          userLocation={liveLocation}
          showRecenter
          recenterLabel={t("recenter")}
        />

        {selectedShop ? (
          <div className="absolute left-5 top-5 z-[1000] w-[360px] max-w-[calc(100%-2.5rem)]">
            <ShopDetailCard
              key={selectedShop.id}
              shop={selectedShop}
              t={t}
              variant="desktop"
              className="max-h-[calc(100vh-180px)]"
              onClose={onCloseMapShop}
              onBook={onBook}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile: full-screen map + bottom drawer list. Selecting a shop      */
/* swaps the drawer for the detail sheet; back returns to the list     */
/* (images 3 & 4).                                                     */
/* ------------------------------------------------------------------ */
function ExploreMobile({ state, allShops, t, onHome, onSearch, onToggleOpenNow, onToggleUnderPrice, onToggleFav, onSelectMapShop, onCloseMapShop, onBook }) {
  // MAP set: filtered ONLY by the quick-filter chips + favourites toggle — NOT the
  // text query — so typing re-centers the map instead of making non-matching pins
  // vanish. `allShops` is in the deps so this recomputes when the DB catalog
  // arrives after first paint. `now` anchors the "open now" check to page load.
  const [now] = useState(() => new Date());
  const mapShops = useMemo(() => {
    let result = allShops;
    if (state.openNow) {
      result = result.filter((s) => {
        const open = isShopOpenNow(s, now);
        return open === null ? s.open : open; // unknown hours → stored flag
      });
    }
    if (state.maxPrice != null) {
      result = result.filter((s) => s.starting > 0 && s.starting < state.maxPrice);
    }
    if (state.activeFav) {
      result = result.filter((s) => (state.favorites ?? []).includes(s.id));
    }
    return result;
  }, [state.openNow, state.maxPrice, state.activeFav, state.favorites, allShops, now]);
  // LIST set: when searching, the elastic/typo-tolerant ranked results for the
  // drawer list; otherwise the default browse order — partners first, then nearest.
  const listShops = useMemo(
    () => (state.search ? rankShops(mapShops, state.search, null) : sortByPartnerThenDistance(mapShops)),
    [mapShops, state.search]
  );
  // Re-center the map on the single best text match (without selecting it).
  const bestMatchId = useMemo(
    () => (state.search ? getBestShopMatch(mapShops, state.search, null) : null),
    [mapShops, state.search]
  );
  const liveLocation = useGeolocation(userLocation);
  const selectedShop = allShops.find((shop) => shop.id === state.mapShop) ?? null;

  return (
    <section className="relative h-full overflow-hidden bg-white">
      <InteractiveMap
        className="absolute inset-0"
        shops={mapShops}
        selectedId={state.mapShop}
        focusShopId={bestMatchId}
        onSelectShop={onSelectMapShop}
        userLocation={liveLocation}
        showRecenter
        recenterLabel={t("recenter")}
      />

      <IconButton
        label={t("back")}
        onClick={onHome}
        className="absolute left-4 top-4 z-[1000] bg-white/90 shadow-device backdrop-blur"
      >
        <Icon name="ArrowLeft" className="h-5 w-5" />
      </IconButton>

      {selectedShop ? (
        <BottomSheet snapPoints={[0.9, 0.5, 0.2]} initialSnapIndex={1} handleLabel={t("resizeSheet")}>
          <div className="flex min-h-0 flex-1 flex-col">
            <ShopDetailCard
              key={selectedShop.id}
              shop={selectedShop}
              t={t}
              variant="mobile"
              onBack={onCloseMapShop}
              onBook={onBook}
            />
          </div>
        </BottomSheet>
      ) : (
        <BottomSheet
          snapPoints={[0.9, 0.5, 0.2]}
          initialSnapIndex={1}
          handleLabel={t("resizeSheet")}
          handle={<h2 className="px-4 pb-1 pt-2 font-display text-lg font-black">{t("nearbyCarWashes")}</h2>}
        >
          <div className="grid shrink-0 gap-3 px-4 pb-3 pt-1">
            <SearchBar value={state.search} onChange={onSearch} t={t} activeFav={state.activeFav} onToggleFav={onToggleFav} />
            <FilterChips t={t} openNow={state.openNow} underPrice={state.maxPrice != null} onToggleOpenNow={onToggleOpenNow} onToggleUnderPrice={onToggleUnderPrice} />
          </div>
          <div className="grid gap-3 overflow-y-auto px-4 pb-5">
            {listShops.length ? (
              listShops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} t={t} onSelect={onSelectMapShop} />
              ))
            ) : (
              <div className="rounded-[18px] border border-black/10 bg-white p-7 text-center text-sm text-neutral-500">{t("noResults")}</div>
            )}
          </div>
        </BottomSheet>
      )}
    </section>
  );
}
