import { MapPlaceholder } from "./MapPlaceholder.jsx";

// MiniMapCard / MapPreview are thin wrappers around the temporary map
// placeholder. They keep the existing call sites working until the real map
// library is integrated.

export function MiniMapCard({ className }) {
  return <MapPlaceholder className={className ?? "aspect-[345/201] w-full"} />;
}

export function MapPreview({ large = false }) {
  if (large) {
    return <MapPlaceholder className="h-[356px] w-full" rounded="rounded-none" />;
  }
  return <MapPlaceholder className="aspect-[345/201] w-full" />;
}
