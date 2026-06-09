import { getVisibleShops } from "../lib/booking.js";
import { useIsDesktop } from "../lib/useIsDesktop.js";
import { Icon } from "../components/ui/Icon.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";
import { MapPlaceholder } from "../components/map/MapPlaceholder.jsx";
import { ShopCard } from "../components/ShopCard.jsx";

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

function ExploreMobile({ state, t, onLang, onHome, onSearch, onShop, onQuickView }) {
  const visibleShops = getVisibleShops(state.search);

  return (
    <section className="flex h-full flex-col bg-white px-3.5 pb-5 pt-7">
      <TopBar compact title={t("explore")} t={t} lang={state.lang} onLang={onLang} onHome={onHome} />
      <div className="grid gap-3">
        <SearchBar value={state.search} onChange={onSearch} t={t} />
        <FilterChips t={t} />
      </div>
      <div className="mt-3 grid gap-3 overflow-y-auto">
        {visibleShops.length ? (
          visibleShops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} t={t} onSelect={onShop} onQuickView={onQuickView} />
          ))
        ) : (
          <div className="rounded-[18px] border border-black/10 bg-white p-7 text-center text-sm text-neutral-500">{t("noResults")}</div>
        )}
      </div>
    </section>
  );
}

function ExploreDesktop({ state, t, onSearch, onShop, onQuickView }) {
  const visibleShops = getVisibleShops(state.search);

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
              <ShopCard key={shop.id} shop={shop} t={t} onSelect={onShop} onQuickView={onQuickView} />
            ))
          ) : (
            <div className="rounded-[18px] border border-black/10 bg-white p-7 text-center text-sm text-neutral-500">{t("noResults")}</div>
          )}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <MapPlaceholder className="h-full w-full" rounded="rounded-none" label={t("explore")} />
      </div>
    </section>
  );
}
