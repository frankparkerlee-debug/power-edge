"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Leaflet is BUNDLED (not loaded from a CDN) so ad blockers / privacy
// extensions / restrictive networks can't block it. OpenStreetMap tiles (fine
// for this traffic; swap to a keyed provider if volume grows).

type Pt = { lat: number; lon: number; size: number; miles: number };

function hailColor(size: number) {
  if (size >= 1.5) return "#ff5a1f";
  if (size >= 1) return "#7ffbae";
  return "#9aa4b2";
}

export function HailMap({
  home,
  points,
  radiusMi = 15,
}: {
  home: { lat: number; lon: number };
  points: Pt[];
  radiusMi?: number;
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
      }).setView([home.lat, home.lon], 11);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      [5, 10, 15]
        .filter((m) => m <= radiusMi)
        .forEach((m) => {
          L.circle([home.lat, home.lon], {
            radius: m * 1609.34,
            color: "#94a3b8",
            weight: 1,
            opacity: 0.5,
            fill: false,
          }).addTo(map);
        });

      points.forEach((p) => {
        const c = hailColor(p.size);
        L.circleMarker([p.lat, p.lon], {
          radius: p.size >= 2 ? 8 : p.size >= 1.5 ? 6 : p.size >= 1 ? 5 : 4,
          color: c,
          fillColor: c,
          fillOpacity: 0.65,
          weight: 1,
        })
          .bindPopup(`${p.size}" hail · ${p.miles} mi away`)
          .addTo(map);
      });

      const homeIcon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid #7ffbae;box-shadow:0 0 0 3px rgba(127,251,174,.35)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([home.lat, home.lon], { icon: homeIcon })
        .addTo(map)
        .bindPopup("Your address")
        .openPopup();

      // Ensure tiles lay out correctly once the container is sized.
      setTimeout(() => mapRef.current && mapRef.current.invalidateSize(), 250);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [home, points, radiusMi]);

  return (
    <div
      ref={ref}
      className="h-full w-full bg-ink"
      style={{ minHeight: 240 }}
      aria-label="Map of reported hail near your address"
    />
  );
}
