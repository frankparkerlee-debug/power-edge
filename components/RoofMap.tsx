"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Satellite/aerial view of the home's roof — makes the estimate feel real
// ("that's MY roof"). Esri World Imagery tiles (free, no key); Leaflet bundled.
export function RoofMap({
  home,
  zoom = 19,
}: {
  home: { lat: number; lon: number };
  zoom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      const L = (mod as any).default ?? mod;
      if (cancelled || !ref.current || mapRef.current) return;
      const map = L.map(ref.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      }).setView([home.lat, home.lon], zoom);
      mapRef.current = map;

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 21, attribution: "Imagery &copy; Esri" },
      ).addTo(map);

      const marker = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#7ffbae;border:3px solid #0b0e13;box-shadow:0 0 0 4px rgba(127,251,174,.35)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([home.lat, home.lon], { icon: marker }).addTo(map);

      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 250);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [home, zoom]);

  return (
    <div
      ref={ref}
      className="h-full w-full bg-ink"
      style={{ minHeight: 200 }}
      aria-label="Satellite view of your roof"
    />
  );
}
