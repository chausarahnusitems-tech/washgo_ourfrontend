"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Helpers for the bits of navigation state that now live in the URL
 * (`?q` search, `?shop` map selection, `?quick` quick-view). `setParams`
 * merges updates into the current query string; pass `null`/"" to drop a key.
 */
export function useUrlNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildHref = (updates) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const setParams = (updates, { replace = true } = {}) => {
    const href = buildHref(updates);
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  };

  return { router, pathname, searchParams, setParams };
}
