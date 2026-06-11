"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

// useLayoutEffect on the client (runs before paint), useEffect on the server
// (avoids the SSR warning). Resolving the match before paint stops the wrong
// layout from flashing for a frame on client-side navigation.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Tracks whether the viewport is at the `lg` breakpoint or wider.
 * Used to switch between the mobile (single column + bottom nav) and the
 * desktop (top nav + multi-column) layouts.
 *
 * Returns `null` until the match is known (server render + the very first client
 * render), so callers can render nothing instead of guessing "mobile" — which on
 * a desktop viewport would paint the full-width mobile layout (big red hero /
 * membership cards) for one frame before swapping. The match is resolved in a
 * layout effect, before the browser paints, so navigation doesn't flash.
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(null);

  useIsoLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!window.matchMedia) {
      setIsDesktop(false);
      return undefined;
    }
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event) => setIsDesktop(event.matches);
    setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
