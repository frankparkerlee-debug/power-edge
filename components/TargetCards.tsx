"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mobile knock cards + NATIVE map mode (no app-switching):
//  • "Near me" queries the server for every target within 15mi of the rep's
//    GPS position (full DB, true distance sort) — honest empty state.
//  • List ⇄ Map toggle: tapping an address shows that door on the in-app
//    Leaflet map (rep's position as a blue dot) instead of launching Google
//    Maps. A small "Directions ↗" stays in the popup for turn-by-turn.

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

export type TargetCard = {
  id: string;
  owner_name: string;
  address: string;
  city: string;
  zip: string;
  hail_size_in: number | null;
  solar: boolean;
  absentee: boolean;
  year_built: number | null;
  value: number | null;
  score: number;
  lat: number | null;
  lon: number | null;
  phone?: string | null;
  phone_dnc?: boolean | null;
  status?: string;
};

type NearTarget = TargetCard & { distance_mi: number };

function adminKey() {
  return new URLSearchParams(window.location.search).get("key") || "";
}

function fmtMi(mi: number) {
  if (mi < 0.19) return `${Math.round(mi * 5280)} ft`;
  return `${mi.toFixed(1)} mi`;
}

function gmapsHref(t: TargetCard) {
  return `https://maps.google.com/?q=${encodeURIComponent(
    `${t.address}, ${t.city || ""} TX ${t.zip || ""}`,
  )}`;
}

type HouseData = {
  loading: boolean;
  roof: { roofSqft: number; squares: number; pitchDeg: number | null } | null;
  storms: Array<{ date: string; type: string; magnitude: number | null; city: string; mi: number }>;
};

/** Full-screen house dossier: satellite view of THEIR roof + measured squares
 *  + every storm near the address. The at-the-door show piece. */
function HouseSheet({
  target,
  data,
  onClose,
}: {
  target: TargetCard;
  data: HouseData;
  onClose: () => void;
}) {
  const satDiv = useRef<HTMLDivElement>(null);
  const satRef = useRef<any>(null);

  useEffect(() => {
    if (target.lat == null || target.lon == null) return;
    let cancelled = false;
    import("leaflet").then((mod) => {
      const L = (mod as any).default ?? mod;
      if (cancelled || !satDiv.current || satRef.current) return;
      const map = L.map(satDiv.current, { zoomControl: true, attributionControl: false }).setView(
        [target.lat as number, target.lon as number],
        20,
      );
      satRef.current = map;
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxNativeZoom: 19, maxZoom: 21 },
      ).addTo(map);
      L.circleMarker([target.lat as number, target.lon as number], {
        radius: 10,
        color: "#7ffbae",
        weight: 3,
        fill: false,
      }).addTo(map);
      setTimeout(() => map.invalidateSize(), 200);
    });
    return () => {
      cancelled = true;
      if (satRef.current) {
        satRef.current.remove();
        satRef.current = null;
      }
    };
  }, [target]);

  const hailStorms = data.storms.filter((s) => s.type === "hail");
  const windStorms = data.storms.filter((s) => s.type !== "hail");

  return (
    // z must clear Leaflet's internal panes/controls (z-index up to ~1000)
    <div className="fixed inset-0 z-[1200] flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-display text-base font-extrabold">{target.owner_name}</div>
          <div className="truncate text-xs text-gray-500">
            {target.address}
            {target.city ? `, ${target.city}` : ""}
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-3 shrink-0 rounded-full bg-[#0b0e13] px-4 py-2 text-sm font-bold text-white"
        >
          ✕ Close
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Satellite */}
        <div ref={satDiv} className="h-[42vh] w-full" aria-label="Satellite view of the roof" />

        {/* Roof measurement */}
        <div className="border-b border-gray-100 px-4 py-3">
          {data.loading ? (
            <p className="text-sm text-gray-500">Measuring roof from satellite…</p>
          ) : data.roof ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#0b0e13] px-3 py-1.5 text-sm font-bold text-white">
                ~{data.roof.squares} squares
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700">
                {data.roof.roofSqft.toLocaleString()} sqft roof surface
              </span>
              {data.roof.pitchDeg != null && (
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700">
                  ~{data.roof.pitchDeg}° pitch
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Satellite measurement unavailable for this roof — measure on-site.
            </p>
          )}
          <p className="mt-1.5 text-xs text-gray-400">
            Measured from satellite imagery (actual 3-D roof surface, +10% waste). Exact count
            confirmed at the free inspection.
          </p>
        </div>

        {/* Storm history */}
        <div className="px-4 py-3">
          <h3 className="font-display text-sm font-extrabold uppercase tracking-wide">
            Storms near this home (12 mo)
          </h3>
          {data.loading ? (
            <p className="mt-1 text-sm text-gray-500">Loading storm history…</p>
          ) : data.storms.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500">
              No documented reports within 10 miles in the window.
            </p>
          ) : (
            <>
              <ul className="mt-2 space-y-1.5">
                {hailStorms.slice(0, 12).map((s, i) => (
                  <li key={`h${i}`} className="flex items-center gap-2 text-sm">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        (s.magnitude ?? 0) >= 1.75
                          ? "bg-red-100 text-red-800"
                          : (s.magnitude ?? 0) >= 1
                            ? "bg-amber-100 text-amber-900"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {s.magnitude ? `${s.magnitude}″ hail` : "hail"}
                    </span>
                    <span className="text-gray-700">{s.date}</span>
                    <span className="text-gray-400">
                      {s.mi} mi away{s.city ? ` · ${s.city}` : ""}
                    </span>
                  </li>
                ))}
                {windStorms.slice(0, 5).map((s, i) => (
                  <li key={`w${i}`} className="flex items-center gap-2 text-sm">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                      {s.type === "wind_gust" && s.magnitude ? `${s.magnitude} mph wind` : "wind damage"}
                    </span>
                    <span className="text-gray-700">{s.date}</span>
                    <span className="text-gray-400">{s.mi} mi away</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
                Official NWS storm reports near this address. Reported hail nearby doesn&apos;t
                guarantee damage here — the free documented inspection is how we find out, and
                if the roof is fine we say so in writing.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function TargetCards({ targets }: { targets: TargetCard[] }) {
  const [locState, setLocState] = useState<"off" | "locating" | "on" | "denied" | "error">("off");
  const [nearTargets, setNearTargets] = useState<NearTarget[] | null>(null);
  const [emptyInfo, setEmptyInfo] = useState<{ city: string; mi: number } | null>(null);
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [house, setHouse] = useState<TargetCard | null>(null);
  const [houseData, setHouseData] = useState<HouseData>({ loading: false, roof: null, storms: [] });
  const [converted, setConverted] = useState<Record<string, "working" | "done" | "error">>({});

  const promote = async (t: TargetCard) => {
    if (converted[t.id] === "working" || converted[t.id] === "done") return;
    setConverted((c) => ({ ...c, [t.id]: "working" }));
    try {
      const res = await fetch("/api/admin/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey(), id: t.id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setConverted((c) => ({ ...c, [t.id]: "done" }));
    } catch {
      setConverted((c) => ({ ...c, [t.id]: "error" }));
    }
  };

  const convertState = (t: TargetCard): "idle" | "working" | "done" | "error" =>
    converted[t.id] === "done" || t.status === "converted"
      ? "done"
      : (converted[t.id] ?? "idle");

  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  const reset = () => {
    setLocState("off");
    setNearTargets(null);
    setEmptyInfo(null);
    setMe(null);
  };

  const locate = () => {
    if (locState === "on") return reset();
    if (!navigator.geolocation) return setLocState("denied");
    setLocState("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const params = new URLSearchParams(window.location.search);
          const key = params.get("key") || "";
          const days = params.get("days") || "";
          const res = await fetch(
            `/api/admin/storm-targets?key=${encodeURIComponent(key)}&near=${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}${days ? `&days=${days}` : ""}`,
          );
          if (!res.ok) throw new Error(String(res.status));
          const data = await res.json();
          setMe({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setNearTargets(data.targets ?? []);
          setEmptyInfo(data.nearest_beyond ?? null);
          setLocState("on");
        } catch {
          setLocState("error");
        }
      },
      () => setLocState("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const showing: Array<{ t: TargetCard; mi: number | null }> =
    locState === "on" && nearTargets
      ? nearTargets.map((t) => ({ t, mi: t.distance_mi }))
      : targets.map((t) => ({ t, mi: null }));
  const mappable = showing.filter(({ t }) => t.lat != null && t.lon != null);

  // Map lifecycle — init when entering map view, redraw on data/focus change.
  useEffect(() => {
    if (view !== "map") return;
    let cancelled = false;
    import("leaflet").then((mod) => {
      const L = (mod as any).default ?? mod;
      if (cancelled || !mapDiv.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(mapDiv.current, { zoomControl: true });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap &copy; CARTO",
        }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }
      const map = mapRef.current;
      const layer = layerRef.current;
      layer.clearLayers();

      if (me) {
        L.circleMarker([me.lat, me.lon], {
          radius: 8,
          color: "#fff",
          weight: 3,
          fillColor: "#2563eb",
          fillOpacity: 1,
        })
          .bindPopup("You are here")
          .addTo(layer);
      }

      const focus = mappable.find(({ t }) => t.id === focusId);
      let focusMarker: any = null;
      for (const { t, mi } of mappable) {
        const isFocus = t.id === focusId;
        const color = t.solar ? "#0c7a40" : isFocus ? "#ff8a1f" : "#0b0e13";
        const m = L.circleMarker([t.lat as number, t.lon as number], {
          radius: isFocus ? 11 : 7,
          color: "#fff",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.95,
        })
          .bindPopup(
            `<b>${t.owner_name}</b><br/>${t.address}${t.city ? `, ${t.city}` : ""}` +
              `<br/>${t.hail_size_in ? `${t.hail_size_in}″ hail · ` : ""}score ${t.score}` +
              `${t.solar ? " · ☀️ solar" : ""}${mi != null ? ` · ${fmtMi(mi)} away` : ""}` +
              `<br/><a href="#" data-house-id="${t.id}"><b>🏠 Roof &amp; storm history</b></a>` +
              ` · <a href="${gmapsHref(t)}" target="_blank" rel="noopener">Directions ↗</a>`,
          )
          .addTo(layer);
        if (isFocus) focusMarker = m;
      }

      if (focus) {
        map.setView([focus.t.lat as number, focus.t.lon as number], 17);
      } else if (mappable.length > 0) {
        const pts = mappable.map(({ t }) => [t.lat, t.lon]);
        if (me) pts.push([me.lat, me.lon]);
        map.fitBounds(pts as any, { padding: [30, 30], maxZoom: 16 });
      } else if (me) {
        map.setView([me.lat, me.lon], 13);
      }
      // Open the focused popup AFTER the container has its real size —
      // opening while the map is 0×0 silently no-ops.
      setTimeout(() => {
        map.invalidateSize();
        if (focusMarker) focusMarker.openPopup();
      }, 250);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, nearTargets, focusId, me, targets]);

  // Tear down the map when leaving map view so re-entry is clean.
  useEffect(() => {
    if (view === "list" && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      layerRef.current = null;
    }
  }, [view]);

  const showOnMap = (id: string) => {
    setFocusId(id);
    setView("map");
  };

  const openHouse = (t: TargetCard) => {
    setHouse(t);
    setHouseData({ loading: true, roof: null, storms: [] });
    const key = new URLSearchParams(window.location.search).get("key") || "";
    fetch(`/api/admin/house?key=${encodeURIComponent(key)}&lat=${t.lat}&lon=${t.lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setHouseData({ loading: false, roof: d.roof ?? null, storms: d.storms ?? [] }))
      .catch(() => setHouseData({ loading: false, roof: null, storms: [] }));
  };

  // Map popups are plain HTML — delegate their "roof & storms" links here.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.("[data-house-id]");
      if (!el) return;
      e.preventDefault();
      const id = el.getAttribute("data-house-id");
      const all = nearTargets ?? targets;
      const t = all.find((x) => x.id === id);
      if (t) openHouse(t);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearTargets, targets]);

  return (
    <div className="mt-3 md:hidden">
      <button
        onClick={locate}
        className={`mb-2 w-full rounded-lg px-4 py-3 text-sm font-bold ${
          locState === "on"
            ? "bg-[#0b0e13] text-white"
            : "border-2 border-[#0c7a40] bg-white text-[#0c7a40]"
        }`}
      >
        {locState === "locating"
          ? "Finding doors near you…"
          : locState === "on"
            ? `📍 ${nearTargets?.length ?? 0} doors within 15 mi — tap to reset`
            : locState === "denied"
              ? "Location blocked — enable it in browser settings, then tap again"
              : locState === "error"
                ? "Couldn't load nearby doors — tap to retry"
                : "📍 Near me — show doors around where I'm standing"}
      </button>

      {/* List ⇄ Map toggle */}
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg border border-gray-200 p-1 text-center text-sm font-bold">
        <button
          onClick={() => setView("list")}
          className={`rounded-md py-2 ${view === "list" ? "bg-[#0b0e13] text-white" : "text-gray-600"}`}
        >
          List
        </button>
        <button
          onClick={() => {
            setFocusId(null);
            setView("map");
          }}
          className={`rounded-md py-2 ${view === "map" ? "bg-[#0b0e13] text-white" : "text-gray-600"}`}
        >
          Map
        </button>
      </div>

      {locState === "on" && nearTargets && nearTargets.length === 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-bold">No storm targets within 15 miles of you.</p>
          <p className="mt-1 text-gray-700">
            {emptyInfo
              ? `Nearest cluster: ${emptyInfo.city}, about ${emptyInfo.mi} miles away.`
              : "No targets found in this region for the current filters."}
            {" "}Try widening the recency filter, or work inbound leads instead.
          </p>
        </div>
      )}

      {/* Native map view */}
      <div
        ref={mapDiv}
        className={`${view === "map" ? "" : "hidden"} h-[62vh] w-full overflow-hidden rounded-lg border border-gray-200`}
        aria-label="Knock map"
      />
      {view === "map" && (
        <p className="mt-1.5 text-xs text-gray-500">
          ⬤ black = target · ⬤ green = solar · ⬤ blue = you. Tap a pin for details.
        </p>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="space-y-2">
          {showing.map(({ t, mi }) => (
            <div
              key={t.id}
              className={`rounded-lg border p-3 ${
                t.solar ? "border-green-300 bg-green-50" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{t.owner_name}</div>
                  {t.lat != null ? (
                    <button
                      onClick={() => showOnMap(t.id)}
                      className="text-left text-sm font-medium text-[#0c7a40] underline"
                    >
                      {t.address}
                      {t.city ? `, ${t.city}` : ""} 🗺
                    </button>
                  ) : (
                    <a
                      href={gmapsHref(t)}
                      target="_blank"
                      rel="noopener"
                      className="text-sm font-medium text-[#0c7a40] underline"
                    >
                      {t.address}
                      {t.city ? `, ${t.city}` : ""} ↗
                    </a>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {mi != null && (
                    <div className="mb-1 rounded-full bg-[#0c7a40] px-2.5 py-1 text-xs font-bold text-white">
                      {fmtMi(mi)}
                    </div>
                  )}
                  <span className="inline-block rounded-full bg-[#0b0e13] px-2.5 py-1 text-xs font-bold text-white">
                    {t.score}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                {t.hail_size_in ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                    {t.hail_size_in}″ hail
                  </span>
                ) : null}
                {t.solar && (
                  <span className="rounded-full bg-green-200 px-2 py-0.5 font-semibold text-green-900">
                    ☀️ solar
                  </span>
                )}
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                  {t.absentee ? "Absentee" : "Owner-occupied"}
                </span>
                {t.year_built ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                    built {t.year_built}
                  </span>
                ) : null}
                {t.value ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                    ${Math.round(t.value / 1000)}k
                  </span>
                ) : null}
              </div>
              {/* Phone row — only when skip-traced and callable */}
              {t.phone && !t.phone_dnc && (
                <a
                  href={`tel:${t.phone}`}
                  className="mt-2 block rounded-lg border border-[#0c7a40] py-2 text-center text-sm font-bold text-[#0c7a40]"
                >
                  📞 Call {t.phone.replace(/(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")}
                </a>
              )}
              {t.phone && t.phone_dnc && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-center text-xs font-semibold text-red-700">
                  ⛔ Do-Not-Call list — knock or mail only
                </p>
              )}
              {/* Actions */}
              <div className="mt-2 flex items-center gap-2 text-xs">
                <button
                  onClick={() => promote(t)}
                  disabled={convertState(t) !== "idle" && convertState(t) !== "error"}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${
                    convertState(t) === "done"
                      ? "bg-green-600 text-white"
                      : convertState(t) === "working"
                        ? "bg-gray-300 text-gray-600"
                        : convertState(t) === "error"
                          ? "bg-red-600 text-white"
                          : "bg-[#0c7a40] text-white"
                  }`}
                >
                  {convertState(t) === "done"
                    ? "✓ Lead created"
                    : convertState(t) === "working"
                      ? "Converting…"
                      : convertState(t) === "error"
                        ? "Failed — tap to retry"
                        : "Convert to lead"}
                </button>
                {t.lat != null && (
                  <button
                    onClick={() => openHouse(t)}
                    className="rounded-lg bg-[#0b0e13] px-3 py-2.5 font-bold text-white"
                  >
                    🏠 Roof
                  </button>
                )}
                <a
                  href={gmapsHref(t)}
                  target="_blank"
                  rel="noopener"
                  className="text-gray-400 underline"
                >
                  Directions ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {house && (
        <HouseSheet target={house} data={houseData} onClose={() => setHouse(null)} />
      )}
    </div>
  );
}
