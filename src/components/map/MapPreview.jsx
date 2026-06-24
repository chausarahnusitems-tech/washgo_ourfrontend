"use client";

import { userLocation } from "../../data/catalog.js";
import { useApp } from "../../lib/AppContext.jsx";
import { useGeolocation } from "../../lib/useGeolocation.js";
import { InteractiveMap } from "./InteractiveMapDynamic.jsx";

// MiniMapCard / MapPreview render a static (non-interactive) snapshot of the
// real map with the car-wash pins. They are click-through, so call sites can
// wrap them in a button that navigates to the full map page.

export function MiniMapCard({ className }) {
  const { catalog } = useApp();
  const liveLocation = useGeolocation(userLocation);
  return (
    <InteractiveMap
      interactive={false}
      shops={catalog.shops ?? []}
      userLocation={liveLocation}
      className={className ?? "aspect-[345/201] w-full"}
      rounded="rounded-[18px]"
    />
  );
}

export function MapPreview({ large = false, className }) {
  const { catalog } = useApp();
  const liveLocation = useGeolocation(userLocation);
  return (
    <InteractiveMap
      interactive={false}
      shops={catalog.shops ?? []}
      userLocation={liveLocation}
      className={className ?? (large ? "h-[356px] w-full" : "aspect-[345/201] w-full")}
      rounded={large ? "rounded-none" : "rounded-[18px]"}
    />
  );
}
