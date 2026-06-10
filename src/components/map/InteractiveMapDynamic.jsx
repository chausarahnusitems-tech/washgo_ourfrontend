"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`/`document` at module load (it builds L.icon markers),
// so the map must never render on the server. This dynamic, client-only export
// is a drop-in replacement for the original `InteractiveMap` (same props).
export const InteractiveMap = dynamic(
  () => import("./InteractiveMap.jsx").then((mod) => mod.InteractiveMap),
  { ssr: false, loading: () => null }
);
