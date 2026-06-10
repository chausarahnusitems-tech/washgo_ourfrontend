"use client";

import { useEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Tracks whether the viewport is at the `lg` breakpoint or wider.
 * Used to switch between the mobile (single column + bottom nav) and the
 * desktop (top nav + multi-column) layouts.
 *
 * Initialises to `false` on both the server and the first client render so
 * hydration stays consistent, then resolves the real match after mount.
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event) => setIsDesktop(event.matches);
    mql.addEventListener("change", onChange);
    setIsDesktop(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
