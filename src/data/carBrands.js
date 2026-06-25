// Brand metadata for the vehicle picker / "My Vehicle" card. Built on top of the
// curated CAR_MAKES dataset (carModels.js). We deliberately do NOT bundle
// trademarked brand logo artwork: the BrandLogo component loads a real logo from
// /brands/<slug>.svg only if one has been supplied, and otherwise renders a clean
// colour + initials monogram. The colours below are just the monogram backgrounds
// (brand-associated accents), not logos.

import { CAR_MAKES } from "./carModels.js";

const BRAND_COLORS = {
  Toyota: "#EB0A1E",
  Hyundai: "#002C5F",
  Kia: "#05141F",
  Honda: "#CC0000",
  Mazda: "#101010",
  Ford: "#003478",
  Mitsubishi: "#E60012",
  VinFast: "#1A3B8B",
  Suzuki: "#E40521",
  Nissan: "#C3002F",
  Isuzu: "#D81E05",
  Chevrolet: "#B59410",
  MG: "#CC0000",
  Peugeot: "#00205B",
  "Mercedes-Benz": "#1A1A1A",
  BMW: "#0066B1",
  Audi: "#BB0A30",
  Lexus: "#1A1A1A",
  "Land Rover": "#005A2B",
  Porsche: "#C8102E",
  Volvo: "#003057",
  Volkswagen: "#001E50",
  MINI: "#1A1A1A",
  Subaru: "#013C74",
  BYD: "#D81E05",
  Wuling: "#C8102E",
  Haval: "#C8102E",
  Chery: "#B0000A",
  GAC: "#003478",
  "Lynk & Co": "#1A1A1A",
  Other: "#6B7280"
};
const DEFAULT_COLOR = "#6B7280";

// Logo files live at /brands/<slug>.<ext>. The default is SVG; list any brand
// whose asset is a raster file here to override it (the rest stay "svg").
const DEFAULT_LOGO_EXT = "png";
const BRAND_LOGO_EXT = {
  // Example — uncomment / add as needed:
  // Toyota: "png",
  // BYD: "webp",
};

// URL-safe slug for the (optional) logo file: "Mercedes-Benz" -> "mercedes-benz".
export function brandSlug(make) {
  return String(make ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Short monogram for the fallback chip: two-word brands -> initials ("Land Rover"
// -> "LR"), short all-caps acronyms kept whole ("MG", "BMW"), else first two letters.
export function brandInitials(make) {
  const name = String(make ?? "").trim();
  if (!name) return "";
  const words = name.split(/[\s&-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const word = words[0];
  if (word === word.toUpperCase() && word.length <= 3) return word;
  return word.slice(0, 2).toUpperCase();
}

export function getBrandMeta(make) {
  const name = String(make ?? "").trim();
  const slug = name ? brandSlug(name) : "";
  const ext = BRAND_LOGO_EXT[name] ?? DEFAULT_LOGO_EXT;
  return {
    name,
    slug,
    ext,
    logo: slug ? `/brands/${slug}.${ext}` : "",
    color: BRAND_COLORS[name] ?? DEFAULT_COLOR,
    initials: brandInitials(name)
  };
}

// The brands offered in the picker, in the curated dataset order.
export const BRAND_NAMES = CAR_MAKES.map((entry) => entry.make);

// Models/series for a make ("Other" has no concrete models).
export function modelsForBrand(make) {
  const entry = CAR_MAKES.find((item) => item.make === make);
  if (!entry || entry.make === "Other") return [];
  return entry.models;
}

// Best-effort make detection from a stored "Make Model" string, so the logo can be
// derived even when `brand` wasn't set explicitly (legacy data / booking edits).
// Longest make name first so "Mercedes-Benz" wins over a shorter prefix.
export function brandFromModel(model) {
  const value = String(model ?? "").trim().toLowerCase();
  if (!value) return "";
  const match = BRAND_NAMES.filter((make) => make !== "Other")
    .sort((a, b) => b.length - a.length)
    .find((make) => value.startsWith(make.toLowerCase()));
  return match ?? "";
}
