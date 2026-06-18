"use client";

import { useEffect, useState } from "react";

// Track the device's real location (lat/lng). Starts at `fallback` (a sensible
// default centre) and updates as the browser reports positions via the
// Geolocation API. Returns the fallback unchanged when geolocation is
// unavailable or the user denies permission, so callers always have coords.
export function useGeolocation(fallback) {
  const [coords, setCoords] = useState(fallback ?? null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        /* keep the fallback on error / permission denied */
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return coords;
}
