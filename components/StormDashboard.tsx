"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

// Admin storm-engine dashboard map + timeline. Leaflet is bundled (same reason
// as HailMap: ad blockers kill CDN loads). Dark-friendly admin styling.

export type DashEvent = {
  valid_at: string;
  type: string; // hail | wind_gust | wind_dmg
  magnitude: number | null;
  city: string;
  lat: number;
  lon: number;
};

export type DashSolarZip = {
  zip: string;
  permits: number;
  lat: number | null;
  lon: number | null;
};

export type DashCheck = {
  address: string;
  lat: number | null;
  lon: number | null;
  largest_in: number | null;
  qualifies: boolean | null;
};

const DFW = { lat: 32.85, lon: -97.03 };

function hailColor(size: number) {
  if (size >= 1.75) return "#ff3b1f";
  if (size >= 1.25) return "#ff8a1f";
  if (size >= 1) return "#ffc21f";
  return "#9aa4b2";
}

export function StormDashboard({
  events,
  solarZips,
  checks,
}: {
  events: DashEvent[];
  solarZips: DashSolarZip[];
  checks: DashCheck[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [day, setDay] = useState<string>("all");
  const [showSolar, setShowSolar] = useState(true);
  const [showChecks, setShowChecks] = useState(true);

  // Storm days, newest first, with per-day intensity for the timeline strip.
  const days = useMemo(() => {
    const m = new Map<string, { hail: number; maxHail: number; wind: number }>();
    for (const e of events) {
      const d = e.valid_at.slice(0, 10);
      const cur = m.get(d) || { hail: 0, maxHail: 0, wind: 0 };
      if (e.type === "hail") {
        cur.hail++;
        cur.maxHail = Math.max(cur.maxHail, e.magnitude ?? 0);
      } else cur.wind++;
      m.set(d, cur);
    }
    return [...m.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [events]);

  const filtered = useMemo(
    () => (day === "all" ? events : events.filter((e) => e.valid_at.slice(0, 10) === day)),
    [events, day],
  );

  // Init map once.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      const L = (mod as any).default ?? mod;
      if (cancelled || !ref.current || mapRef.current) return;
      const map = L.map(ref.current, { scrollWheelZoom: true, zoomControl: true }).setView(
        [DFW.lat, DFW.lon],
        9,
      );
      mapRef.current = map;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap &copy; CARTO",
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      setTimeout(() => map.invalidateSize(), 250);
    });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  // Redraw markers on filter change.
  useEffect(() => {
    import("leaflet").then((mod) => {
      const L = (mod as any).default ?? mod;
      const layer = layerRef.current;
      if (!layer) return;
      layer.clearLayers();

      // Solar density — one translucent circle per zip, scaled by permit count.
      if (showSolar) {
        for (const z of solarZips) {
          if (z.lat == null || z.lon == null) continue;
          L.circle([z.lat, z.lon], {
            radius: Math.min(4200, 900 + z.permits * 2.2),
            color: "#0c7a40",
            weight: 1,
            opacity: 0.5,
            fillColor: "#0c7a40",
            fillOpacity: 0.14,
          })
            .bindPopup(`<b>${z.zip}</b><br/>${z.permits} solar-permitted homes`)
            .addTo(layer);
        }
      }

      // Storm reports.
      for (const e of filtered) {
        if (e.type === "hail") {
          const s = e.magnitude ?? 0;
          const c = hailColor(s);
          L.circleMarker([e.lat, e.lon], {
            radius: s >= 2 ? 10 : s >= 1.5 ? 8 : s >= 1 ? 6 : 4,
            color: c,
            fillColor: c,
            fillOpacity: 0.7,
            weight: 1,
          })
            .bindPopup(
              `<b>${s ? `${s}″ hail` : "Hail"}</b><br/>${e.city}<br/>${e.valid_at.slice(0, 10)}`,
            )
            .addTo(layer);
        } else {
          L.circleMarker([e.lat, e.lon], {
            radius: 5,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.55,
            weight: 1,
          })
            .bindPopup(
              `<b>${
                e.type === "wind_gust" ? `${e.magnitude ?? "?"} mph gust` : "Wind damage"
              }</b><br/>${e.city}<br/>${e.valid_at.slice(0, 10)}`,
            )
            .addTo(layer);
        }
      }

      // Self-checked addresses — people who ran the claim check.
      if (showChecks) {
        for (const c of checks) {
          if (c.lat == null || c.lon == null) continue;
          L.circleMarker([c.lat, c.lon], {
            radius: 6,
            color: "#0b0e13",
            fillColor: c.qualifies ? "#7ffbae" : "#e5e7eb",
            fillOpacity: 0.95,
            weight: 2,
          })
            .bindPopup(
              `<b>Self-checked</b><br/>${c.address || ""}<br/>${
                c.qualifies ? `Likely qualifies (${c.largest_in ?? "?"}″)` : "Did not qualify"
              }`,
            )
            .addTo(layer);
        }
      }
    });
  }, [filtered, solarZips, checks, showSolar, showChecks]);

  const maxDayCount = Math.max(1, ...days.map((d) => d.hail + d.wind));

  return (
    <div>
      {/* Controls */}
      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="all">All storm days (90d)</option>
          {days.map((d) => (
            <option key={d.date} value={d.date}>
              {d.date} — {d.hail} hail{d.maxHail ? ` (max ${d.maxHail}″)` : ""}, {d.wind} wind
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showSolar}
            onChange={(e) => setShowSolar(e.target.checked)}
          />
          Solar density
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showChecks}
            onChange={(e) => setShowChecks(e.target.checked)}
          />
          Self-checked addresses
        </label>
        <span className="ml-auto flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#ffc21f" }} />1″+ hail</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#ff3b1f" }} />1.75″+</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#3b82f6" }} />wind</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#0c7a40", opacity: 0.4 }} />solar zips</span>
        </span>
      </div>

      {/* Map */}
      <div
        ref={ref}
        className="mt-3 w-full overflow-hidden rounded-lg border border-gray-200"
        style={{ height: 520 }}
        aria-label="Storm activity map"
      />

      {/* Timeline strip — click a bar to filter the map to that day */}
      {days.length > 0 && (
        <div className="mt-4">
          <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ height: 72 }}>
            {[...days].reverse().map((d) => {
              const h = Math.max(6, ((d.hail + d.wind) / maxDayCount) * 60);
              const active = day === d.date;
              const major = d.maxHail >= 1;
              return (
                <button
                  key={d.date}
                  title={`${d.date} — ${d.hail} hail, ${d.wind} wind${d.maxHail ? `, max ${d.maxHail}″` : ""}`}
                  onClick={() => setDay(active ? "all" : d.date)}
                  className="shrink-0 rounded-sm transition-opacity hover:opacity-80"
                  style={{
                    width: 14,
                    height: h,
                    background: active ? "#0b0e13" : major ? "#ff8a1f" : "#cbd5e1",
                  }}
                />
              );
            })}
          </div>
          <p className="text-xs text-gray-500">
            Storm-day timeline (oldest → newest). Orange = 1″+ hail day. Click to filter the map.
          </p>
        </div>
      )}
    </div>
  );
}
