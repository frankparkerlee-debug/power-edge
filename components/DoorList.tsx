"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { addLightBasemap } from "@/lib/basemap";
import type { Door } from "@/app/api/doors/route";

/**
 * Best doors: a ranked list of houses around a point, with the reasons each
 * one is worth a knock. Knocking itself stays on the knock map; a door that
 * is not on the knock list yet gets one button that puts it there.
 */

type Kind = "hail" | "wind" | "roof" | "other";
type Filter = "all" | Exclude<Kind, "other">;

const COLOR: Record<Kind, string> = {
  hail: "#0c7a40",
  wind: "#2563eb",
  roof: "#d97706",
  other: "#9ca3af",
};

const OUTCOME: Record<string, string> = {
  not_home: "Not home",
  not_interested: "Not interested",
  come_back: "Come back",
  appointment_set: "Appointment set",
};

const YEAR = new Date().getFullYear();
const DAY = 86400 * 1000;

const windRecent = (d: Door) => !!d.wind_date && Date.now() - Date.parse(d.wind_date) <= 365 * DAY;
const roofMayBeOriginal = (d: Door) =>
  d.roof_basis === "built" && !!d.year_built && YEAR - d.year_built >= 15 && YEAR - d.year_built <= 30;

function kindOf(d: Door): Kind {
  if ((d.hail_in ?? 0) >= 1) return "hail";
  if (windRecent(d)) return "wind";
  if (roofMayBeOriginal(d)) return "roof";
  return "other";
}

function reasonKind(r: string): Kind | "owner" {
  if (r.startsWith("About")) return "hail";
  if (/^(Tornado|Roof damage|Wind damage|\d+ mph)/.test(r)) return "wind";
  if (r.startsWith("Built") || r.startsWith("Golf-ball")) return "roof";
  return "owner";
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function DoorList({
  adminKey,
  initialNear,
  initialQuery,
}: {
  adminKey: string;
  initialNear: string;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [mi, setMi] = useState(1);
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "error">(
    initialNear || initialQuery ? "loading" : "idle",
  );
  const [error, setError] = useState("");
  const [center, setCenter] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [doors, setDoors] = useState<Door[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [ownerOnly, setOwnerOnly] = useState(false);
  const [added, setAdded] = useState<Record<string, "working" | "done" | "error">>({});
  const [focus, setFocus] = useState<string | null>(null);
  const lastAsk = useRef<string>("");

  const keyParam = adminKey ? `&key=${encodeURIComponent(adminKey)}` : "";

  type Result = { ok: boolean; d: { error?: string; center?: typeof center; doors?: Door[] } };

  const fetchDoors = useCallback(
    (ask: string, radius: number): Promise<Result> =>
      fetch(`/api/doors?${ask}&mi=${radius}${keyParam}`)
        .then(async (r) => ({ ok: r.ok, d: await r.json() }))
        .catch(() => ({ ok: false, d: { error: "Couldn't reach the server. Try again." } })),
    [keyParam],
  );

  const apply = useCallback(({ ok, d }: Result) => {
    if (!ok || !d.center || !d.doors) {
      setError(d.error || "Couldn't load doors.");
      setStatus("error");
      return;
    }
    setCenter(d.center);
    setDoors(d.doors);
    setFocus(null);
    setStatus("idle");
  }, []);

  const load = (ask: string, radius: number) => {
    lastAsk.current = ask;
    setStatus("loading");
    setError("");
    fetchDoors(ask, radius).then(apply);
  };

  const nearMe = () => {
    if (!navigator.geolocation) {
      setError("This browser can't share its location. Type an address instead.");
      setStatus("error");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => load(`near=${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`, mi),
      () => {
        setError("Location is off. Type an address instead.");
        setStatus("error");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  const search = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) load(`q=${encodeURIComponent(query.trim())}`, mi);
  };

  // Deep links: /admin/doors?near=lat,lon or ?q=address
  useEffect(() => {
    const ask = initialNear
      ? `near=${encodeURIComponent(initialNear)}`
      : initialQuery
        ? `q=${encodeURIComponent(initialQuery)}`
        : "";
    if (!ask) return;
    lastAsk.current = ask;
    let cancelled = false;
    fetchDoors(ask, 1).then((res) => {
      if (!cancelled) apply(res);
    });
    return () => {
      cancelled = true;
    };
  }, [initialNear, initialQuery, fetchDoors, apply]);

  const changeRadius = (r: number) => {
    setMi(r);
    if (lastAsk.current) load(lastAsk.current, r);
  };

  const pool = useMemo(() => (ownerOnly ? doors.filter((d) => !d.absentee) : doors), [doors, ownerOnly]);
  const counts = useMemo(
    () => ({
      all: pool.length,
      hail: pool.filter((d) => (d.hail_in ?? 0) >= 1).length,
      wind: pool.filter(windRecent).length,
      roof: pool.filter(roofMayBeOriginal).length,
    }),
    [pool],
  );
  const shown = useMemo(() => {
    if (filter === "hail") return pool.filter((d) => (d.hail_in ?? 0) >= 1);
    if (filter === "wind") return pool.filter(windRecent);
    if (filter === "roof") return pool.filter(roofMayBeOriginal);
    return pool;
  }, [pool, filter]);

  const addToList = async (d: Door) => {
    setAdded((a) => ({ ...a, [d.address]: "working" }));
    try {
      const res = await fetch(`/api/doors?${keyParam.slice(1)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: d.lat, lon: d.lon, address: d.address }),
      });
      if (!res.ok) throw new Error();
      setAdded((a) => ({ ...a, [d.address]: "done" }));
    } catch {
      setAdded((a) => ({ ...a, [d.address]: "error" }));
    }
  };

  /* ---------------- map ---------------- */
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const cardRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  useEffect(() => {
    if (!center) return;
    let cancelled = false;
    import("leaflet").then((mod) => {
      const L = (mod as any).default ?? mod;
      if (cancelled || !mapDiv.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(mapDiv.current, { zoomControl: true, attributionControl: false });
        addLightBasemap(L, mapRef.current, 19);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }
      const map = mapRef.current;
      const layer = layerRef.current;
      layer.clearLayers();
      markers.current.clear();

      L.circleMarker([center.lat, center.lon], {
        radius: 8, color: "#fff", weight: 3, fillColor: "#0b0e13", fillOpacity: 1,
      }).addTo(layer);

      // Draw the long tail first so the numbered top doors sit on top.
      shown
        .map((d, i) => ({ d, i }))
        .reverse()
        .forEach(({ d, i }) => {
          const c = COLOR[kindOf(d)];
          const m =
            i < 40
              ? L.marker([d.lat, d.lon], {
                  icon: L.divIcon({
                    className: "",
                    html: `<div style="background:${c};color:#fff;border:2px solid #fff;border-radius:9999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font:700 12px/1 system-ui;box-shadow:0 1px 3px rgba(0,0,0,.35)">${i + 1}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                  }),
                })
              : L.circleMarker([d.lat, d.lon], {
                  radius: 5, color: "#fff", weight: 1.5, fillColor: c, fillOpacity: 0.9,
                });
          m.on("click", () => {
            setFocus(d.address);
            cardRefs.current.get(d.address)?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
          m.addTo(layer);
          markers.current.set(d.address, m);
        });

      const pts = shown.slice(0, 40).map((d) => [d.lat, d.lon]);
      pts.push([center.lat, center.lon]);
      setTimeout(() => {
        map.invalidateSize();
        if (pts.length > 1) map.fitBounds(pts as any, { padding: [24, 24], maxZoom: 17 });
        else map.setView([center.lat, center.lon], 15);
      }, 60);
    });
    return () => {
      cancelled = true;
    };
  }, [center, shown]);

  const showOnMap = (d: Door) => {
    setFocus(d.address);
    mapRef.current?.setView([d.lat, d.lon], 18);
    mapDiv.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  /* ---------------- render ---------------- */
  const busy = status === "locating" || status === "loading";
  const chip = (f: Filter, label: string, n: number) => (
    <button
      key={f}
      type="button"
      onClick={() => setFilter(f)}
      className={`rounded-full px-3 py-1.5 text-sm font-medium ${
        filter === f ? "bg-[#0b0e13] text-white" : "bg-gray-100 text-gray-700"
      }`}
    >
      {f !== "all" && (
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: COLOR[f] }} />
      )}
      {label} <span className={filter === f ? "text-white/70" : "text-gray-400"}>{n}</span>
    </button>
  );

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={nearMe}
          disabled={busy}
          className="rounded-lg bg-[#0b0e13] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {status === "locating" ? "Finding you…" : "Near me"}
        </button>
        <form onSubmit={search} className="flex flex-1 gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Address, ZIP or city"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            Go
          </button>
        </form>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-gray-500">Within</span>
        {[0.5, 1, 2].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => changeRadius(r)}
            className={`rounded-full px-3 py-1 ${mi === r ? "bg-[#0b0e13] text-white" : "bg-gray-100 text-gray-700"}`}
          >
            {r === 0.5 ? "½" : r} mi
          </button>
        ))}
      </div>

      {status === "error" && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">{error}</p>
      )}
      {status === "loading" && <p className="mt-4 text-sm text-gray-500">Ranking doors…</p>}

      {center && status !== "loading" && (
        <>
          <p className="mt-4 truncate text-sm text-gray-500">
            Around <span className="font-medium text-gray-800">{center.label}</span>
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {chip("all", "All", counts.all)}
            {chip("hail", "Hail", counts.hail)}
            {chip("wind", "Wind", counts.wind)}
            {chip("roof", "Older roof", counts.roof)}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={ownerOnly} onChange={(e) => setOwnerOnly(e.target.checked)} />
            Owner lives here
          </label>

          <div ref={mapDiv} className="relative z-0 mt-3 h-64 w-full overflow-hidden rounded-lg border border-gray-200 md:h-80" />

          {shown.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No doors match. Try a wider radius or another filter.</p>
          ) : (
            <ol className="mt-4 space-y-2">
              {shown.slice(0, 150).map((d, i) => {
                const k = kindOf(d);
                const state = added[d.address];
                const onList = d.src === "target" || state === "done";
                return (
                  <li
                    key={d.address}
                    ref={(el) => {
                      if (el) cardRefs.current.set(d.address, el);
                    }}
                    className={`rounded-lg border p-3 ${focus === d.address ? "border-[#0b0e13] ring-1 ring-[#0b0e13]" : "border-gray-200"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                        style={{ background: COLOR[k] }}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <button type="button" onClick={() => showOnMap(d)} className="block max-w-full text-left">
                          <span className="block truncate font-semibold">{d.street}</span>
                        </button>
                        <div className="truncate text-[13px] text-gray-500">
                          {d.city} · {d.dist_mi < 0.1 ? "here" : `${d.dist_mi.toFixed(1)} mi`}
                          {d.owner_name ? ` · ${d.owner_name}` : ""}
                        </div>
                        <ul className="mt-2 space-y-1">
                          {d.reasons.map((r) => {
                            const rk = reasonKind(r);
                            return (
                              <li key={r} className="flex items-start gap-2 text-sm text-gray-800">
                                <span
                                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                                  style={{ background: rk === "owner" ? "#d1d5db" : COLOR[rk] }}
                                />
                                {r}
                              </li>
                            );
                          })}
                        </ul>
                        {d.last_outcome && d.last_knock_at && (
                          <p className="mt-2 text-[13px] text-gray-500">
                            Last knock: {OUTCOME[d.last_outcome] ?? d.last_outcome}, {fmtDate(d.last_knock_at)}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                          {onList ? (
                            <a href="/admin/storms" className="text-sm font-bold text-[#0c7a40] underline">
                              On knock list
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addToList(d)}
                              disabled={state === "working"}
                              className="rounded-lg bg-[#0b0e13] px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                            >
                              {state === "working" ? "Adding…" : state === "error" ? "Try again" : "Add to knock list"}
                            </button>
                          )}
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lon}`}
                            target="_blank"
                            rel="noopener"
                            className="text-sm font-medium text-gray-700 underline"
                          >
                            Directions
                          </a>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {shown.length > 150 && (
            <p className="mt-3 text-[13px] text-gray-500">Showing the top 150. Narrow the radius to see the rest.</p>
          )}
          <p className="mt-6 text-[13px] leading-relaxed text-gray-500">
            Hail is a radar estimate (NOAA), not a measurement. Wind and tornadoes are National Weather
            Service reports within a mile. Roof age is a guess from the year built and hail since 2020.
          </p>
        </>
      )}
    </div>
  );
}
