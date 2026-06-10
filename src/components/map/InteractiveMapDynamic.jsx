"use client";

import dynamic from "next/dynamic";

// MapLibre GL touches `window`/`document` at module load, so the map must never
// render on the server. This dynamic, client-only export is a drop-in
// replacement for the underlying `InteractiveMap` (same props).
export const InteractiveMap = dynamic(
  () => import("./InteractiveMap.jsx").then((mod) => mod.InteractiveMap),
  { ssr: false, loading: () => null }
);
