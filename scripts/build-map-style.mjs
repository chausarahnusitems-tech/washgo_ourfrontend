// Generates the Washgo MapLibre basemap style by recoloring OpenFreeMap's
// "Positron" style with a clean, minimalist, Waze-like pastel palette.
//
// We keep all of Positron's layer filters and zoom logic untouched (so the map
// stays geographically correct) and only override colors. The generated style
// still references OpenFreeMap's vector tiles, fonts and sprites by URL.
//
//   Run:  node scripts/build-map-style.mjs
//   Out:  public/map/washgo-style.json
//
// Re-run this whenever you want to re-pull upstream or tweak the palette below.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UPSTREAM = "https://tiles.openfreemap.org/styles/positron";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../public/map/washgo-style.json");

// --- Palette -----------------------------------------------------------------
// Pastel green + pastel blue + light/dark greys. Tuned for a calm, low-contrast
// Waze-style daytime look: light land, soft blue water, soft green parks,
// white roads with light-grey casings, dark-grey labels.
const C = {
  land: "#eef2f3", // base land / background — very light cool grey
  residential: "#e9eded", // built-up areas — a hair darker than land
  water: "#bcdcec", // pastel blue
  waterway: "#a9cfe0", // rivers/streams — slightly deeper pastel blue
  park: "#bfe3c4", // pastel green (parks)
  wood: "#bbe0bf", // pastel green (woodland)
  grass: "#c6e7ca", // pastel green — the dominant vegetation (grass/park/garden/meadow)
  wetland: "#cde7d9", // pastel green with a hint of teal (marsh)
  farmland: "#d4ead3", // soft green (farm fields)
  buildingFill: "#e3e8e9", // light grey building footprints
  buildingLine: "#d6dcdd",
  roadWhite: "#ffffff", // major road fill
  roadMinor: "#f5f7f7", // minor road fill — near-white
  roadCasing: "#d8dee1", // light-grey road casing
  roadSubtle: "rgba(186,201,206,0.55)", // faint low-zoom road hint
  path: "#e3e8e9",
  rail: "#dbe1e2",
  railDash: "#f2f5f5",
  boundary: "#a7b1b6", // muted grey admin borders
  labelDark: "#4f5a61", // dark grey for place labels
  labelMid: "#6b757b", // medium grey for road labels
  halo: "#ffffff",
  waterLabel: "#4f86a3", // blue-grey, harmonizes with pastel water
  waterwayLabel: "#8fb6c8",
};

// Low→high zoom road color (subtle at world scale, white when zoomed in).
const roadZoom = ["interpolate", ["linear"], ["zoom"], 5.8, C.roadSubtle, 6, C.roadWhite];

// --- Per-layer paint overrides (merged into each layer's existing paint) ------
const OVERRIDES = {
  background: { "background-color": C.land },

  // Land cover / use
  park: { "fill-color": C.park },
  landuse_residential: { "fill-color": C.residential },
  landcover_wood: { "fill-color": C.wood },

  // Water
  water: { "fill-color": C.water },
  waterway: { "line-color": C.waterway },

  // Buildings
  building: { "fill-color": C.buildingFill, "fill-outline-color": C.buildingLine },

  // Roads — casings (light grey) + inner fills (white / near-white)
  tunnel_motorway_casing: { "line-color": C.roadCasing },
  tunnel_motorway_inner: { "line-color": C.roadMinor },
  highway_path: { "line-color": C.path },
  highway_minor: { "line-color": C.roadMinor },
  highway_major_casing: { "line-color": C.roadCasing },
  highway_major_inner: { "line-color": C.roadWhite },
  highway_major_subtle: { "line-color": C.roadSubtle },
  highway_motorway_casing: { "line-color": C.roadCasing },
  highway_motorway_inner: { "line-color": roadZoom },
  highway_motorway_subtle: { "line-color": C.roadSubtle },
  highway_motorway_bridge_casing: { "line-color": C.roadCasing },
  highway_motorway_bridge_inner: { "line-color": roadZoom },

  // Rail
  railway_transit: { "line-color": C.rail },
  railway_transit_dashline: { "line-color": C.railDash },
  railway_service: { "line-color": C.rail },
  railway_service_dashline: { "line-color": C.railDash },
  railway: { "line-color": C.rail },
  railway_dashline: { "line-color": C.railDash },

  // Admin boundaries
  boundary_3: { "line-color": C.boundary },
  boundary_2: { "line-color": C.boundary },
  boundary_disputed: { "line-color": C.boundary },

  // Labels
  waterway_line_label: { "text-color": C.waterwayLabel },
  water_name_point_label: { "text-color": C.waterLabel },
  water_name_line_label: { "text-color": C.waterLabel },
  "highway-name-path": { "text-color": C.labelMid },
  "highway-name-minor": { "text-color": C.labelMid },
  "highway-name-major": { "text-color": C.labelMid },
  airport: { "text-color": C.labelDark, "text-halo-color": C.halo },
  label_other: { "text-color": C.labelDark, "text-halo-color": C.halo },
  label_village: { "text-color": C.labelDark, "text-halo-color": C.halo },
  label_town: { "text-color": C.labelDark, "text-halo-color": C.halo },
  label_state: { "text-color": C.labelDark, "text-halo-color": C.halo },
  label_city: { "text-color": C.labelDark, "text-halo-color": C.halo },
  label_city_capital: { "text-color": C.labelDark, "text-halo-color": C.halo },
  label_country_3: { "text-color": C.labelDark, "text-halo-color": C.halo },
  label_country_2: { "text-color": C.labelDark, "text-halo-color": C.halo },
  label_country_1: { "text-color": C.labelDark, "text-halo-color": C.halo },
};

// --- Extra vegetation layers --------------------------------------------------
// Positron is a minimalist grey style and omits most greenery, so the map looks
// far less green than Waze. These layers draw vegetation that already exists in
// the vector tiles (grass, scrub, wetland, farmland, recreation grounds).
const POLY = ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false];
const fadeIn = ["interpolate", ["linear"], ["zoom"], 7, 0, 11, 1]; // ease in with zoom

const GREEN_LAYERS = [
  {
    id: "wg_landcover_grass",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landcover",
    filter: ["all", POLY, ["match", ["get", "class"], ["grass", "scrub"], true, false]],
    paint: { "fill-color": C.grass, "fill-opacity": fadeIn },
  },
  {
    id: "wg_landcover_wetland",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landcover",
    filter: ["all", POLY, ["==", ["get", "class"], "wetland"]],
    paint: { "fill-color": C.wetland, "fill-opacity": fadeIn },
  },
  {
    id: "wg_landcover_farmland",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landcover",
    filter: ["all", POLY, ["==", ["get", "class"], "farmland"]],
    paint: { "fill-color": C.farmland, "fill-opacity": fadeIn },
  },
  {
    id: "wg_landuse_green",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landuse",
    filter: [
      "all",
      POLY,
      ["match", ["get", "class"], ["cemetery", "pitch", "playground", "stadium", "theme_park", "zoo", "recreation_ground", "golf_course"], true, false],
    ],
    paint: { "fill-color": C.grass },
  },
];

const res = await fetch(UPSTREAM);
if (!res.ok) throw new Error(`Failed to fetch upstream style: ${res.status}`);
const style = await res.json();

style.name = "Washgo Clean";
let touched = 0;
const seen = new Set();
for (const layer of style.layers) {
  const ov = OVERRIDES[layer.id];
  if (!ov) continue;
  layer.paint = { ...(layer.paint || {}), ...ov };
  seen.add(layer.id);
  touched++;
}

// Warn if any override id no longer matches upstream (schema drift).
const missing = Object.keys(OVERRIDES).filter((id) => !seen.has(id));
if (missing.length) console.warn("Overrides with no matching layer:", missing.join(", "));

// Insert the extra vegetation layers just above the land/background and BELOW
// water, so rivers and ponds stay blue on top of the green land (as in Waze).
// Built-up shading (landuse_residential) draws later, so dense city areas keep
// their grey tone while the vegetated peninsula reads green.
const anchor = style.layers.findIndex((l) => l.id === "park");
const at = anchor === -1 ? 1 : anchor + 1;
style.layers.splice(at, 0, ...GREEN_LAYERS);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(style));
console.log(`Wrote ${OUT} — recolored ${touched}/${style.layers.length} layers.`);
