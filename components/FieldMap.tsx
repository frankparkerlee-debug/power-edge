"use client";

/**
 * The knock map, built for a rep on a sidewalk.
 *
 * It opens on where the rep is standing (or a ZIP), shows doors with 2 in+
 * radar hail at the house (or 1 in+, or older roofs with or without hail),
 * colors every pin by where the door stands with us (gray not knocked, blue
 * a Dallas roof permit in the last 10 years, yellow working, red said no,
 * green signed or done; a bigger pin with a dark ring is a priority knock),
 * and groups the list by street in house-number order so they can walk it,
 * or ranks it priority and best door first. Tap a door and everything they can do there is one tap
 * away: not home, come back, no (with the reason), book the inspection, call,
 * the roof and storm history, storm alerts, the job.
 *
 * Doors come from Best doors' coverage (storm targets, county records, Dallas
 * permits), so most of them are not on the knock list yet. The first action
 * on such a door adds it, dated by its hail, then records the action.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { TILES } from "@/lib/basemap";
import { BookAtDoor } from "./BookAtDoor";
import { ComeBackSheet } from "./ComeBackSheet";
import { HouseSheet, type HouseData, type TargetCard } from "./TargetCards";

type DoorState =
  | { kind: "new"; by?: string | null; when?: string | null }
  | { kind: "not_home"; by?: string | null; when?: string | null }
  | { kind: "come_back"; at?: string | null; by?: string | null; when?: string | null }
  | { kind: "no"; by?: string | null; when?: string | null; note?: string | null }
  | { kind: "appointment"; at?: string | null }
  | { kind: "job"; stage?: string };

type Door = {
  key: string;
  target_id: string | null;
  address: string;
  full_address: string;
  num: string;
  street: string;
  city: string;
  county: string;
  zip: string;
  owner_name: string;
  absentee: boolean | null;
  lat: number;
  lon: number;
  dist_mi: number;
  year_built: number | null;
  value: number | null;
  hail_in: number | null;
  storm_date: string | null;
  roof_note: string | null;
  wind_note: string | null;
  recent_roof: boolean;
  recent_permit: boolean;
  score: number;
  /** Old roof or repeat storms, with a storm inside the 1-year claim window. */
  priority: boolean;
  priority_why: string | null;
  /** Storms, wind reports, permits, the claim window: short lines for the row. */
  signals: string[];
  claim: "open" | "cash" | null;
  phone: string | null;
  phone_dnc: boolean;
  job_id: string | null;
  state: DoorState;
};

const STAGE_LABEL: Record<string, string> = {
  new: "In the pipeline",
  contacted: "Contacted",
  inspection_booked: "Inspection booked",
  inspected: "Inspected",
  agreement_sent: "Agreement sent",
  signed: "Signed",
  in_production: "In production",
  complete: "Complete",
};

const NO_REASONS = [
  "Already replaced",
  "Has a roofer",
  "No damage they can see",
  "Worried about the deductible",
  "Just not interested",
] as const;

// Pin colors say where a door stands with us (Parker, 2026-11-11).
const GRAY = "#8a919c"; // not knocked yet
const BLUE = "#2563eb"; // Dallas roof permit in the last 10 years: repairs, fence, siding
const YELLOW = "#eab308"; // working: come back, inspection booked, job not signed yet
const RED = "#d23a2f"; // said no, or the job was lost
const GREEN = "#0c7a40"; // signed, in production or complete
const INK = "#0b0e13";

/** A Leaflet tile layer, as far as the Map / Aerial switch needs one. */
type Tile = { addTo: (map: unknown) => unknown };

/** Road lines and street names drawn over the aerial (Esri reference layer, no key). */
const AERIAL_ROADS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";

/** Job stages that count as a signed deal. */
const SIGNED = new Set(["signed", "in_production", "complete"]);

type View = "priority" | "hail2" | "hail1" | "older";
const VIEWS: Array<[View, string]> = [
  ["priority", "Priority"],
  ["hail2", "2 in+ hail"],
  ["hail1", "1 in+ hail"],
  ["older", "Older roofs"],
];
/** Best first lists this many doors; the map still shows every one. */
const BEST_ROWS = 150;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDay = (d?: string | null) => {
  if (!d) return "";
  const [, m, day] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${day}`;
};
const when = (iso?: string | null) => {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};
const ago = (iso?: string | null) => {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : `${Math.floor(d / 30)} mo ago`;
};
const fmtMi = (mi: number) => (mi < 0.19 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`);
const dueNow = (iso?: string | null) => !!iso && new Date(iso).getTime() <= Date.now() + 2 * 3600e3;

/** Done for a setter: said no, or already in the pipeline. */
const isDone = (s: DoorState) => s.kind === "no" || s.kind === "appointment" || s.kind === "job";

function pinColor(d: Door) {
  switch (d.state.kind) {
    case "job":
      return SIGNED.has(d.state.stage || "") ? GREEN : YELLOW;
    case "appointment":
    case "come_back":
      return YELLOW;
    case "no":
      return RED;
    default:
      return d.recent_permit ? BLUE : GRAY;
  }
}

function stateLine(s: DoorState): { text: string; tone: string } | null {
  switch (s.kind) {
    case "not_home":
      return { text: `Not home ${ago(s.when)}${s.by ? ` · ${s.by}` : ""}`, tone: "text-gray-600" };
    case "come_back":
      return {
        text: s.at ? `Come back ${when(s.at)}` : "Come back",
        tone: dueNow(s.at) ? "font-semibold text-[#8a5a00]" : "text-[#8a5a00]",
      };
    case "no":
      return {
        text: `Said no${s.note?.startsWith("Reason: ") ? `: ${s.note.slice(8).toLowerCase()}` : ""}${s.by ? ` · ${s.by}` : ""}`,
        tone: "font-semibold text-[#b42318]",
      };
    case "appointment":
      return { text: s.at ? `Inspection ${when(s.at)}` : "Inspection booked", tone: "font-semibold text-[#8a5a00]" };
    case "job":
      return {
        text: STAGE_LABEL[s.stage || ""] || "In the pipeline",
        tone: SIGNED.has(s.stage || "") ? "font-semibold text-[#0c7a40]" : "font-semibold text-[#8a5a00]",
      };
    default:
      return null;
  }
}

function asCard(d: Door, id: string): TargetCard {
  return {
    id,
    owner_name: d.owner_name,
    address: d.address,
    city: d.city,
    zip: d.zip,
    hail_size_in: null,
    absentee: !!d.absentee,
    year_built: d.year_built,
    value: d.value,
    score: d.score,
    lat: d.lat,
    lon: d.lon,
    phone: d.phone,
    county: d.county,
  };
}

type Mode = { kind: "near"; lat: number; lon: number; mi: number } | { kind: "zip"; zip: string };

export function FieldMap({ initialZip, initialView }: { initialZip?: string; initialView: View }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [order, setOrder] = useState<"street" | "best">("street");
  const [hideDone, setHideDone] = useState(false);
  const [onlyDue, setOnlyDue] = useState(false);
  const [doors, setDoors] = useState<Door[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "ready" | "denied" | "error">("idle");
  const [error, setError] = useState("");
  const [zipInput, setZipInput] = useState(initialZip || "");
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [openStreets, setOpenStreets] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [booking, setBooking] = useState<{ door: Door; id: string } | null>(null);
  const [comeBack, setComeBack] = useState<{ door: Door; id: string } | null>(null);
  const [noFor, setNoFor] = useState<Door | null>(null);
  const [house, setHouse] = useState<{ card: TargetCard; data: HouseData } | null>(null);

  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  /** Street map and aerial tile layers, swapped by the Map / Aerial switch. */
  const baseRef = useRef<{ street: Tile[]; aerial: Tile[] } | null>(null);
  const [aerial, setAerial] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ---- Loading -----------------------------------------------------------
  const load = useCallback(async (m: Mode, v: View) => {
    setStatus("loading");
    setError("");
    setMode(m);
    const qs = new URLSearchParams();
    if (m.kind === "zip") qs.set("zip", m.zip);
    else {
      qs.set("near", `${m.lat.toFixed(5)},${m.lon.toFixed(5)}`);
      qs.set("mi", String(m.mi));
    }
    if (v !== "hail2") qs.set("view", v);
    // Keep the URL shareable and reload-proof.
    const page = new URLSearchParams(window.location.search);
    if (m.kind === "zip") page.set("zip", m.zip);
    else page.delete("zip");
    page.delete("big");
    if (v !== "hail2") page.set("view", v);
    else page.delete("view");
    window.history.replaceState(null, "", `${window.location.pathname}${page.toString() ? `?${page}` : ""}`);
    try {
      const res = await fetch(`/api/field/doors?${qs}`);
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Couldn't load doors.");
      setDoors(d.doors ?? []);
      setTotal(d.total ?? (d.doors ?? []).length);
      setSelected(null);
      setOpenStreets({});
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load doors.");
      setStatus("error");
    }
  }, []);

  const locate = useCallback(
    (mi = 0.5) => {
      if (!navigator.geolocation) {
        setStatus("denied");
        return;
      }
      setStatus("locating");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setMe(here);
          load({ kind: "near", ...here, mi }, view);
        },
        () => setStatus("denied"),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    },
    [view, load],
  );

  useEffect(() => {
    if (initialZip) load({ kind: "zip", zip: initialZip }, initialView);
    else locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = (v = view) => {
    if (!mode) return locate();
    load(mode, v);
  };

  // ---- What to show ------------------------------------------------------
  const dueCount = useMemo(
    () => doors.filter((d) => d.state.kind === "come_back" && dueNow((d.state as { at?: string | null }).at)).length,
    [doors],
  );

  const visible = useMemo(
    () =>
      doors.filter((d) => {
        if (onlyDue) return d.state.kind === "come_back" && dueNow((d.state as { at?: string | null }).at);
        return !(hideDone && isDone(d.state));
      }),
    [doors, hideDone, onlyDue],
  );

  const streets = useMemo(() => {
    if (order === "best") {
      // One ranked list: open doors by score, then the ones already worked.
      const ranked = [...visible]
        .sort(
          (a, b) =>
            Number(isDone(a.state)) - Number(isDone(b.state)) ||
            Number(b.priority) - Number(a.priority) ||
            b.score - a.score ||
            a.dist_mi - b.dist_mi,
        )
        .slice(0, BEST_ROWS);
      if (!ranked.length) return [];
      return [
        {
          key: "best",
          name: visible.length > BEST_ROWS ? `Best ${BEST_ROWS} doors first` : "Best doors first",
          place: "",
          doors: ranked,
          nearest: Math.min(...ranked.map((d) => d.dist_mi)),
          open: visible.filter((d) => !isDone(d.state)).length,
          priority: visible.filter((d) => d.priority && !isDone(d.state)).length,
          maxHail: Math.max(0, ...ranked.map((d) => d.hail_in ?? 0)),
          ranked: true,
        },
      ];
    }
    const by = new Map<string, Door[]>();
    for (const d of visible) {
      const k = `${d.street}|${d.zip}`;
      by.set(k, [...(by.get(k) ?? []), d]);
    }
    const groups = [...by.entries()].map(([k, list]) => ({
      key: k,
      name: list[0].street,
      place: list[0].city || "",
      doors: list.sort((a, b) => (parseInt(a.num) || 0) - (parseInt(b.num) || 0)),
      nearest: Math.min(...list.map((d) => d.dist_mi)),
      open: list.filter((d) => !isDone(d.state)).length,
      priority: list.filter((d) => d.priority && !isDone(d.state)).length,
      maxHail: Math.max(0, ...list.map((d) => d.hail_in ?? 0)),
      ranked: false,
    }));
    return mode?.kind === "near"
      ? groups.sort((a, b) => a.nearest - b.nearest)
      : groups.sort((a, b) => b.open - a.open || b.maxHail - a.maxHail);
  }, [visible, mode, order]);

  const openCount = visible.filter((d) => !isDone(d.state)).length;
  const priorityCount = visible.filter((d) => d.priority && !isDone(d.state)).length;
  const streetCount = new Set(visible.map((d) => `${d.street}|${d.zip}`)).size;

  // ---- Map ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      const L = (mod as any).default ?? mod;
      if (cancelled || !mapDiv.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapDiv.current, { zoomControl: true, attributionControl: true }).setView([32.78, -97.0], 10);
      // Street names sit between the tiles and the pins, and never catch a tap.
      const labels = map.createPane("labels");
      labels.style.zIndex = "350";
      labels.style.pointerEvents = "none";
      const street = [
        L.tileLayer(TILES.light, { maxZoom: 19, maxNativeZoom: 16, attribution: TILES.attribution }),
        L.tileLayer(TILES.lightLabels, { maxZoom: 19, maxNativeZoom: 16, pane: "labels" }),
      ];
      const aerialLayers = [
        L.tileLayer(TILES.satellite, { maxZoom: 19, attribution: TILES.attribution }),
        L.tileLayer(AERIAL_ROADS, { maxZoom: 19, pane: "labels" }),
      ];
      street.forEach((t) => t.addTo(map));
      baseRef.current = { street, aerial: aerialLayers };
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const L = LRef.current, map = mapRef.current, layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const pts: Array<[number, number]> = [];
    for (const d of visible) {
      const c = pinColor(d);
      const hollow = d.state.kind === "not_home";
      const isSel = d.key === selected;
      // Priority knocks: bigger, with a dark ring, until someone has worked them.
      const pri = d.priority && !isDone(d.state);
      L.circleMarker([d.lat, d.lon], {
        radius: isSel ? 10 : pri ? 8.5 : 6.5,
        color: isSel || (pri && !hollow) ? INK : hollow ? c : "#ffffff",
        weight: isSel ? 3 : hollow ? 2.5 : pri ? 2.5 : 1.5,
        fillColor: hollow ? "#ffffff" : c,
        fillOpacity: 1,
      })
        .on("click", () => selectDoor(d, false))
        .addTo(layer);
      pts.push([d.lat, d.lon]);
    }
    if (me) {
      // You: a dark dot with a halo, so it never reads as a blue permit pin.
      L.circleMarker([me.lat, me.lon], { radius: 15, stroke: false, fillColor: INK, fillOpacity: 0.14 }).addTo(layer);
      L.circleMarker([me.lat, me.lon], { radius: 6, color: "#ffffff", weight: 3, fillColor: INK, fillOpacity: 1 }).addTo(layer);
    }
    if (!selected && pts.length) {
      map.fitBounds(L.latLngBounds(me ? [...pts, [me.lat, me.lon]] : pts), { padding: [24, 24], maxZoom: 17 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selected, me]);

  useEffect(() => {
    const map = mapRef.current, b = baseRef.current;
    if (!map || !b) return;
    const [show, hide] = aerial ? [b.aerial, b.street] : [b.street, b.aerial];
    hide.forEach((t) => map.hasLayer(t) && map.removeLayer(t));
    show.forEach((t) => !map.hasLayer(t) && t.addTo(map));
  }, [aerial]);

  function selectDoor(d: Door, fromList: boolean) {
    setSelected(d.key);
    setActionError("");
    setOpenStreets((o) => ({ ...o, [`${d.street}|${d.zip}`]: true }));
    if (fromList) mapRef.current?.setView([d.lat, d.lon], Math.max(mapRef.current.getZoom(), 17));
    else setTimeout(() => rowRefs.current[d.key]?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }

  // ---- Actions -----------------------------------------------------------
  function update(key: string, patch: Partial<Door>) {
    setDoors((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  /** The door's knock-list id, adding it first if it is not on the list yet. */
  async function ensure(d: Door): Promise<string | null> {
    if (d.target_id) return d.target_id;
    const res = await fetch("/api/field/doors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: d.lat, lon: d.lon, address: d.full_address }),
    });
    const r = await res.json().catch(() => ({}));
    if (!res.ok || !r.target_id) throw new Error(r.error || "Couldn't add this door.");
    update(d.key, { target_id: r.target_id });
    return r.target_id as string;
  }

  async function knock(d: Door, outcome: "not_home" | "not_interested", note?: string) {
    setBusy(d.key);
    setActionError("");
    const before = d.state;
    update(d.key, {
      state: outcome === "not_home" ? { kind: "not_home", when: new Date().toISOString() } : { kind: "no", when: new Date().toISOString(), note },
    });
    try {
      const id = await ensure(d);
      const res = await fetch("/api/admin/knock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: id, outcome, note }),
      });
      if (!res.ok) throw new Error("Not saved. Tap again.");
    } catch (e) {
      update(d.key, { state: before });
      setActionError(e instanceof Error ? e.message : "Not saved. Tap again.");
    } finally {
      setBusy(null);
    }
  }

  async function withTarget(d: Door, then: (id: string) => void) {
    setBusy(d.key);
    setActionError("");
    try {
      const id = await ensure(d);
      if (id) then(id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't add this door.");
    } finally {
      setBusy(null);
    }
  }

  function openHouse(d: Door) {
    const card = asCard(d, d.target_id || d.key);
    setHouse({ card, data: { loading: true, roof: null, roofError: null, storms: [] } });
    fetch(`/api/admin/house?lat=${d.lat}&lon=${d.lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((x) =>
        setHouse({ card, data: { loading: false, roof: x.roof ?? null, roofError: x.roofError ?? null, storms: x.storms ?? [] } }),
      )
      .catch(() => setHouse({ card, data: { loading: false, roof: null, roofError: { reason: "unreachable" }, storms: [] } }));
  }

  const alertHref = (d: Door) =>
    `/storm-alerts?${new URLSearchParams({
      a: `${d.address}${d.city ? `, ${d.city}` : ""}, TX ${d.zip}`,
      lat: String(d.lat),
      lon: String(d.lon),
      ...(d.target_id ? { t: d.target_id } : {}),
    })}`;

  // ---- Render ------------------------------------------------------------
  const chip = (on: boolean) =>
    `rounded-full border px-3.5 py-2 text-sm font-semibold ${on ? "border-[#0b0e13] bg-[#0b0e13] text-white" : "border-gray-300 bg-white text-gray-700"}`;

  return (
    <div className="px-3 pb-24 pt-3 sm:px-5 lg:pb-8">
      {/* Where */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => locate(mode?.kind === "near" ? mode.mi : 0.5)}
          className={`${chip(mode?.kind === "near")} flex items-center gap-1.5`}
        >
          <span aria-hidden>◎</span> {status === "locating" ? "Finding you…" : "Near me"}
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const z = zipInput.trim();
            if (/^\d{5}$/.test(z)) load({ kind: "zip", zip: z }, view);
          }}
          className="flex items-center gap-1.5"
        >
          <input
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            placeholder="ZIP"
            aria-label="ZIP code"
            className={`w-[5.5rem] rounded-full border px-3.5 py-2 text-sm ${mode?.kind === "zip" ? "border-[#0b0e13] font-semibold" : "border-gray-300"}`}
          />
          <button type="submit" className="rounded-full border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold">
            Go
          </button>
        </form>
        {mode?.kind === "near" && (
          <div className="flex items-center gap-1">
            {[0.5, 1, 2].map((m) => (
              <button
                key={m}
                onClick={() => me && load({ kind: "near", lat: me.lat, lon: me.lon, mi: m }, view)}
                className={`rounded-full px-2.5 py-1.5 text-xs font-semibold ${mode.mi === m ? "bg-gray-200 text-gray-900" : "text-gray-500"}`}
              >
                {m === 0.5 ? "½" : m} mi
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Which doors */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {VIEWS.map(([v, label]) => (
          <button
            key={v}
            onClick={() => {
              if (v === view) return;
              setView(v);
              reload(v);
            }}
            className={chip(view === v)}
          >
            {label}
          </button>
        ))}
        <span className="mx-0.5 h-5 w-px bg-gray-300" aria-hidden />
        <button onClick={() => setOrder((o) => (o === "best" ? "street" : "best"))} className={chip(order === "best")}>
          Best first
        </button>
        <button onClick={() => setHideDone((v) => !v)} className={chip(hideDone)}>
          Hide worked
        </button>
        {dueCount > 0 && (
          <button onClick={() => setOnlyDue((v) => !v)} className={`${chip(onlyDue)} ${onlyDue ? "" : "border-[#c58a00] text-[#8a5a00]"}`}>
            {dueCount} come-back{dueCount === 1 ? "" : "s"} due
          </button>
        )}
      </div>

      {/* Status line */}
      <p className="mt-2 text-sm text-gray-600" aria-live="polite">
        {status === "locating"
          ? "Finding your location…"
          : status === "loading"
            ? "Loading doors…"
            : status === "denied"
              ? "Location is off. Turn it on for this site, or type a ZIP."
              : status === "error"
                ? error
                : status === "ready"
                  ? `${openCount.toLocaleString()} door${openCount === 1 ? "" : "s"} to knock${priorityCount ? ` (${priorityCount} priority)` : ""} on ${streetCount} street${streetCount === 1 ? "" : "s"}${
                      mode?.kind === "zip" ? ` in ${mode.zip}` : mode?.kind === "near" ? `, within ${mode.mi === 0.5 ? "½" : mode.mi} mi` : ""
                    }${total > doors.length ? `. Showing the ${mode?.kind === "zip" ? "biggest-hail" : "nearest"} ${doors.length.toLocaleString()} of ${total.toLocaleString()}.` : ""}`
                  : ""}
      </p>

      <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-4">
        {/* Map */}
        <div className="lg:sticky lg:top-[4.5rem] lg:self-start">
          <div className="relative">
            <div ref={mapDiv} className="h-[42vh] w-full overflow-hidden rounded-xl border border-gray-200 lg:h-[calc(100vh-11rem)]" aria-label="Knock map" />
            <div className="absolute right-2 top-2 z-[1000] flex overflow-hidden rounded-lg border border-gray-300 bg-white text-xs font-semibold shadow-sm">
              {([["Map", false], ["Aerial", true]] as const).map(([label, on]) => (
                <button
                  key={label}
                  onClick={() => setAerial(on)}
                  aria-pressed={aerial === on}
                  className={`px-3 py-1.5 ${aerial === on ? "bg-[#0b0e13] text-white" : "text-gray-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
            {[
              [GRAY, "Not knocked"],
              [BLUE, "Roof permit, last 10 yrs (Dallas)"],
              [YELLOW, "Working"],
              [RED, "Said no"],
              [GREEN, "Signed or done"],
            ].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                {l}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: GRAY }} />
              Not home
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3.5 w-3.5 rounded-full border-[2.5px]" style={{ borderColor: INK, background: GRAY }} />
              Priority knock
            </span>
          </div>
        </div>

        {/* Streets */}
        <div className="mt-3 lg:mt-0">
          {status === "ready" && streets.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
              <p className="font-semibold">
                No{" "}
                {view === "priority" ? "priority " : view === "hail2" ? "2 in+ hail " : view === "hail1" ? "1 in+ hail " : "older-roof "}
                doors here.
              </p>
              <p className="mt-1">
                {view === "priority"
                  ? "Priority needs an old roof or repeat storms, and a storm in the last year. Try 1 in+ hail, "
                  : view === "hail2"
                    ? "Try 1 in+ hail or Older roofs, "
                    : view === "hail1"
                      ? "Try Older roofs, "
                      : "Try 1 in+ hail, "}
                {mode?.kind === "near" ? "widen to 2 mi, " : ""}or type another ZIP.
              </p>
            </div>
          )}
          <div className="space-y-2">
            {streets.map((g, gi) => {
              const open = openStreets[g.key] ?? gi === 0;
              return (
                <section key={g.key} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <button
                    onClick={() => setOpenStreets((o) => ({ ...o, [g.key]: !open }))}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    aria-expanded={open}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-display text-[15px] font-bold text-[#0b0e13]">{g.name}</span>
                      <span className="block text-xs text-gray-500">
                        {g.open} to knock{g.priority ? ` · ${g.priority} priority` : ""}{g.place ? ` · ${g.place}` : ""}
                        {g.maxHail >= 0.75 ? ` · up to ${g.maxHail.toFixed(1)}″ hail` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-gray-500">
                      {mode?.kind === "near" && !g.ranked ? fmtMi(g.nearest) : null}
                      <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
                        <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                  {open && (
                    <div className="divide-y divide-gray-100 border-t border-gray-100">
                      {g.doors.map((d) => {
                        const sel = d.key === selected;
                        const st = stateLine(d.state);
                        return (
                          <div
                            key={d.key}
                            ref={(el) => {
                              rowRefs.current[d.key] = el;
                            }}
                            className={sel ? "bg-[#f6f8f6]" : ""}
                          >
                            <button onClick={() => selectDoor(d, true)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                              <span
                                className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
                                style={
                                  d.state.kind === "not_home"
                                    ? { border: `2.5px solid ${pinColor(d)}`, background: "#fff" }
                                    : { background: pinColor(d) }
                                }
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-2">
                                  <span className="truncate text-[15px] text-[#0b0e13]">
                                    {d.priority && !isDone(d.state) && (
                                      <span className="mr-1.5 inline-block rounded bg-[#0b0e13] px-1.5 py-0.5 align-[1px] text-[10px] font-bold uppercase tracking-wide text-white">
                                        Priority
                                      </span>
                                    )}
                                    <span className="font-bold">{g.ranked ? d.address : d.num}</span>
                                    {d.owner_name ? <span className="text-gray-600"> · {d.owner_name}</span> : null}
                                  </span>
                                  {d.hail_in != null && d.hail_in >= 0.75 && (
                                    <span className="shrink-0 text-sm font-bold" style={{ color: d.hail_in >= 2 ? INK : "#6b7280" }}>
                                      {d.hail_in.toFixed(1)}″
                                    </span>
                                  )}
                                </span>
                                <span className="mt-0.5 block text-xs text-gray-500">
                                  {[
                                    d.storm_date ? `Storm ${shortDay(d.storm_date)}` : null,
                                    d.absentee == null ? null : d.absentee ? "Owner lives elsewhere" : "Owner lives here",
                                    d.year_built ? `Built ${d.year_built}` : null,
                                    g.ranked && mode?.kind === "near" ? fmtMi(d.dist_mi) : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                                {st && <span className={`mt-0.5 block text-xs ${st.tone}`}>{st.text}</span>}
                                {d.roof_note && !(d.priority_why?.startsWith("Roof may be original") && !isDone(d.state)) && (
                                  <span className={`mt-0.5 block text-xs ${d.recent_permit ? "font-semibold text-[#1d4ed8]" : "text-gray-600"}`}>
                                    {d.roof_note}
                                  </span>
                                )}
                                {d.recent_permit && d.state.kind === "new" && (
                                  <span className="mt-0.5 block text-xs text-[#1d4ed8]">New roof: pitch repairs, gutters, fence or siding</span>
                                )}
                                {d.priority_why && !isDone(d.state) && (
                                  <span className="mt-0.5 block text-xs font-semibold text-[#0b0e13]">{d.priority_why}</span>
                                )}
                                {d.signals.length > 0 && d.state.kind !== "no" && (
                                  <span className="mt-1 flex flex-wrap gap-1">
                                    {d.signals.map((t) => (
                                      <span
                                        key={t}
                                        className={`rounded px-1.5 py-0.5 text-[11px] leading-tight ${
                                          /likely cash/.test(t) ? "bg-[#fdf2e9] text-[#8a4b12]" : "bg-[#eef0f3] text-gray-700"
                                        }`}
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </span>
                            </button>

                            {sel && (
                              <div className="px-4 pb-4">
                                {d.state.kind === "appointment" || d.state.kind === "job" ? (
                                  d.job_id ? (
                                    <a href={`/admin/jobs/${d.job_id}`} className="block rounded-lg bg-[#0c7a40] py-3 text-center text-sm font-bold text-white">
                                      Open the job
                                    </a>
                                  ) : null
                                ) : (
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      disabled={busy === d.key}
                                      onClick={() => knock(d, "not_home")}
                                      className="rounded-lg border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-800 disabled:opacity-50"
                                    >
                                      Not home
                                    </button>
                                    <button
                                      disabled={busy === d.key}
                                      onClick={() => withTarget(d, (id) => setComeBack({ door: d, id }))}
                                      className="rounded-lg border border-[#c58a00] bg-white py-3 text-sm font-semibold text-[#8a5a00] disabled:opacity-50"
                                    >
                                      Come back
                                    </button>
                                    <button
                                      disabled={busy === d.key}
                                      onClick={() => setNoFor(d)}
                                      className="rounded-lg border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-600 disabled:opacity-50"
                                    >
                                      Said no
                                    </button>
                                    <button
                                      disabled={busy === d.key}
                                      onClick={() => withTarget(d, (id) => setBooking({ door: d, id }))}
                                      className="rounded-lg bg-[#0c7a40] py-3 text-sm font-bold text-white disabled:opacity-50"
                                    >
                                      Book inspection
                                    </button>
                                  </div>
                                )}
                                {actionError && <p className="mt-2 text-sm font-semibold text-red-700">{actionError}</p>}
                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                                  {d.phone && !d.phone_dnc && (
                                    <a href={`tel:${d.phone}`} className="font-semibold text-[#0c7a40]">
                                      Call {d.phone.replace(/(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")}
                                    </a>
                                  )}
                                  <button onClick={() => openHouse(d)} className="font-semibold text-[#0b0e13] underline">
                                    Roof and storms
                                  </button>
                                  <a
                                    href={`https://maps.google.com/?q=${encodeURIComponent(`${d.address}, ${d.city || ""} TX ${d.zip}`)}`}
                                    target="_blank"
                                    rel="noopener"
                                    className="text-gray-600 underline"
                                  >
                                    Directions
                                  </a>
                                  <a href={alertHref(d)} className="text-gray-600 underline">
                                    Storm alerts sign-up
                                  </a>
                                </div>
                                {d.phone_dnc && <p className="mt-2 text-xs text-gray-500">Number is on Do Not Call. Knock only.</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reason for a no */}
      {noFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setNoFor(null)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-lg font-bold">Why not?</p>
            <p className="mt-0.5 text-sm text-gray-600">
              {noFor.num} {noFor.street}. One tap; it helps us pick better doors.
            </p>
            <div className="mt-4 grid gap-2">
              {NO_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    const d = noFor;
                    setNoFor(null);
                    knock(d, "not_interested", `Reason: ${r}`);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-800"
                >
                  {r}
                </button>
              ))}
            </div>
            <button onClick={() => setNoFor(null)} className="mt-3 w-full py-2 text-sm text-gray-500 underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      {booking && (
        <BookAtDoor
          door={{ id: booking.id, address: booking.door.address, city: booking.door.city, zip: booking.door.zip, owner_name: booking.door.owner_name, phone: booking.door.phone }}
          onClose={() => setBooking(null)}
          onBooked={(r) => {
            update(booking.door.key, { state: { kind: "appointment", at: null }, job_id: r.jobId ?? booking.door.job_id });
          }}
        />
      )}

      {comeBack && (
        <ComeBackSheet
          door={{ id: comeBack.id, address: comeBack.door.address, owner_name: comeBack.door.owner_name }}
          onClose={() => setComeBack(null)}
          onSaved={() => update(comeBack.door.key, { state: { kind: "come_back", at: null, when: new Date().toISOString() } })}
        />
      )}

      {house && <HouseSheet target={house.card} data={house.data} onClose={() => setHouse(null)} />}
    </div>
  );
}
