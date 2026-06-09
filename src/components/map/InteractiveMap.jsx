import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { icons } from "../../assets.js";
import { cx } from "../../lib/cx.js";

// Default car-wash pin (uses the brand SVG marker from assets).
const carIcon = L.icon({
  iconUrl: icons.mapCarPin,
  iconSize: [40, 40],
  iconAnchor: [20, 36],
  className: "wg-marker"
});

// Highlighted variant for the currently selected shop — slightly larger.
const carIconActive = L.icon({
  iconUrl: icons.mapCarPin,
  iconSize: [54, 54],
  iconAnchor: [27, 48],
  className: "wg-marker wg-marker--active"
});

// Blue "you are here" puck.
const userIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html:
    '<span style="display:block;width:18px;height:18px;border-radius:9999px;' +
    "background:#2f7df6;border:3px solid #fff;" +
    'box-shadow:0 0 0 6px rgba(47,125,246,0.25),0 1px 4px rgba(0,0,0,0.3)"></span>'
});

const DEFAULT_CENTER = [10.7995, 106.7305];

/**
 * Interactive, pannable/zoomable Leaflet map with a marker per car wash and a
 * "you are here" puck. Clicking a marker calls `onSelectShop(shop.id)`.
 */
export function InteractiveMap({
  shops = [],
  selectedId = null,
  onSelectShop,
  userLocation,
  className,
  rounded = "rounded-none",
  interactive = true
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const selectRef = useRef(onSelectShop);
  selectRef.current = onSelectShop;

  // Init the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      center: userLocation ? [userLocation.lat, userLocation.lng] : DEFAULT_CENTER,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
      // Preview maps (home page) are static, click-through snapshots.
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(map);
    if (interactive) L.control.zoom({ position: "bottomright" }).addTo(map);

    if (userLocation) {
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: -100 }).addTo(map);
    }

    mapRef.current = map;
    // Containers that mount during a layout/transition can mis-measure; nudge.
    const raf = window.requestAnimationFrame(() => map.invalidateSize());

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => map.invalidateSize())
      : null;
    if (observer) observer.observe(containerRef.current);

    return () => {
      window.cancelAnimationFrame(raf);
      if (observer) observer.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Re)build shop markers when the visible set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    shops.forEach((shop) => {
      if (shop.lat == null || shop.lng == null) return;
      const marker = L.marker([shop.lat, shop.lng], {
        icon: shop.id === selectedId ? carIconActive : carIcon,
        riseOnHover: true
      }).addTo(map);
      marker.on("click", () => selectRef.current?.(shop.id));
      markersRef.current[shop.id] = marker;
    });
  }, [shops, selectedId]);

  // Pan/zoom to the selected shop.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const shop = shops.find((item) => item.id === selectedId);
    if (shop?.lat != null) {
      map.setView([shop.lat, shop.lng], Math.max(map.getZoom(), 15), { animate: true });
    }
  }, [selectedId, shops]);

  return (
    <div
      ref={containerRef}
      className={cx("isolate bg-[#e4eef0]", !interactive && "pointer-events-none", rounded, className)}
    />
  );
}
