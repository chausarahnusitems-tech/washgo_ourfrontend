"use client";

import { useRouter } from "next/navigation";

/**
 * Returns a "go back" handler that pops history when there is somewhere to pop
 * to, but falls back to an explicit route otherwise. This keeps Back
 * deterministic on deep links / fresh tabs, where `router.back()` would
 * otherwise leave the app entirely.
 */
export function useBackOr(fallback) {
  const router = useRouter();
  return () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };
}
