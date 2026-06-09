import { useEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

function getMatch() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/**
 * Tracks whether the viewport is at the `lg` breakpoint or wider.
 * Used to switch between the mobile (single column + bottom nav) and the
 * desktop (top nav + multi-column) layouts.
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(getMatch);

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
