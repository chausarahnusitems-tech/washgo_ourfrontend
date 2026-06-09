import { shops, userLocation } from "../../data/catalog.js";
import { InteractiveMap } from "./InteractiveMap.jsx";

// MiniMapCard / MapPreview render a static (non-interactive) snapshot of the
// real map with the car-wash pins. They are click-through, so call sites can
// wrap them in a button that navigates to the full map page.

export function MiniMapCard({ className }) {
  return (
    <InteractiveMap
      interactive={false}
      shops={shops}
      userLocation={userLocation}
      className={className ?? "aspect-[345/201] w-full"}
      rounded="rounded-[18px]"
    />
  );
}

export function MapPreview({ large = false, className }) {
  return (
    <InteractiveMap
      interactive={false}
      shops={shops}
      userLocation={userLocation}
      className={className ?? (large ? "h-[356px] w-full" : "aspect-[345/201] w-full")}
      rounded={large ? "rounded-none" : "rounded-[18px]"}
    />
  );
}
