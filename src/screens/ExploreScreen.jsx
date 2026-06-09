import { shops as allShops, userLocation } from "../data/catalog.js";
import { getVisibleShops } from "../lib/booking.js";
import { useIsDesktop } from "../lib/useIsDesktop.js";
import { Icon } from "../components/ui/Icon.jsx";
import { IconButton } from "../components/ui/Button.jsx";
import { InteractiveMap } from "../components/map/InteractiveMap.jsx";
import { ShopCard } from "../components/ShopCard.jsx";
import { ShopDetailCard } from "../components/ShopDetailCard.jsx";

const filterChips = ["exteriorWash", "interiorWash", "detail"];

export function SearchBar({ value, onChange, t }) {
  return (
    <label className="grid min-h-12 grid-cols-[auto_1fr] items-center gap-3 rounded-full bg-neutral-100 px-4 text-neutral-500">
      <Icon name="Search" className="h-5 w-5" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("searchPlaceholder")}
        className="min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
      />
    </label>
  );
}

export function FilterChips({ t }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      <button type="button" aria-label="Filters" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-wash-300 text-wash-500">
        <Icon name="Filter" className="h-4 w-4" />
      </button>
      {filterChips.map((chip, index) => (
        <button
          key={chip}
          type="button"
          className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold ${
            index === 0 ? "bg-wash-500 text-white" : "border border-black/10 bg-white text-ink"
          }`}
        >
          <Icon name={index === 1 ? "Armchair" : index === 2 ? "TriangleAlert" : "Car"} className="h-4 w-4" />
          {t(chip)}
        </button>
      ))}
    </div>
  );
}

export function ExploreScreen(props) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <ExploreDesktop {...props} /> : <ExploreMobile {...props} />;
}

/* ------------------------------------------------------------------ */
/* Desktop: persistent sidebar list + map; detail card floats next to  */
/* the list (images 1 & 2).                                            */
/* ------------------------------------------------------------------ */
function ExploreDesktop({ state, t, onSearch, onSelectMapShop, onCloseMapShop, onBook }) {
  const visibleShops = getVisibleShops(state.search);
  const selectedShop = allShops.find((shop) => shop.id === state.mapShop) ?? null;

  return (
    <section className="flex h-full">
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-black/10 bg-white">
        <div className="grid gap-3 border-b border-black/10 px-4 py-4">
          <SearchBar value={state.search} onChange={onSearch} t={t} />
          <FilterChips t={t} />
        </div>
        <div className="grid gap-3 overflow-y-auto px-4 py-4">
          {visibleShops.length ? (
            visibleShops.map((shop) => (
              <ShopCard
                key={shop.id}
                shop={shop}
                t={t}
                onSelect={onSelectMapShop}
                onQuickView={onSelectMapShop}
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
          shops={visibleShops}
          selectedId={state.mapShop}
          onSelectShop={onSelectMapShop}
          userLocation={userLocation}
        />

        {selectedShop ? (
          <div className="absolute left-5 top-5 z-[1000] w-[360px] max-w-[calc(100%-2.5rem)]">
            <ShopDetailCard
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
function ExploreMobile({ state, t, onHome, onSearch, onSelectMapShop, onCloseMapShop, onBook }) {
  const visibleShops = getVisibleShops(state.search);
  const selectedShop = allShops.find((shop) => shop.id === state.mapShop) ?? null;

  return (
    <section className="relative h-full overflow-hidden bg-white">
      <InteractiveMap
        className="absolute inset-0"
        shops={visibleShops}
        selectedId={state.mapShop}
        onSelectShop={onSelectMapShop}
        userLocation={userLocation}
      />

      <IconButton
        label="Back"
        onClick={onHome}
        className="absolute left-4 top-4 z-[1000] bg-white/90 shadow-device backdrop-blur"
      >
        <Icon name="ArrowLeft" className="h-5 w-5" />
      </IconButton>

      {selectedShop ? (
        <div className="absolute inset-x-0 bottom-0 z-[1000] h-[64%]">
          <ShopDetailCard
            shop={selectedShop}
            t={t}
            variant="mobile"
            className="shadow-device"
            onBack={onCloseMapShop}
            onBook={onBook}
          />
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 z-[1000] flex h-[60%] flex-col rounded-t-[22px] bg-white shadow-device">
          <div className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-neutral-200" />
          <div className="grid shrink-0 gap-3 px-4 pb-3 pt-2">
            <h2 className="font-display text-lg font-black">{t("nearbyCarWashes")}</h2>
            <SearchBar value={state.search} onChange={onSearch} t={t} />
            <FilterChips t={t} />
          </div>
          <div className="grid gap-3 overflow-y-auto px-4 pb-5">
            {visibleShops.length ? (
              visibleShops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} t={t} onSelect={onSelectMapShop} onQuickView={onSelectMapShop} />
              ))
            ) : (
              <div className="rounded-[18px] border border-black/10 bg-white p-7 text-center text-sm text-neutral-500">{t("noResults")}</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
