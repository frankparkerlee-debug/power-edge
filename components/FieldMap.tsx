"use client";

/**
 * The knock map, built for a rep on a sidewalk.
 *
 * It opens on where the rep is standing (or a ZIP), shows only doors with
 * 2 in+ radar hail at the house unless they widen it, colors every pin by
 * what to do next, and groups the list by street in house-number order so
 * they can walk it. Tap a door and everything they can do there is one tap
 * away: not home, come back, no (with the reason), book the inspection, call,
 * the roof and storm history, storm alerts, the job.
 *
 * Doors come from Best doors' coverage (storm targets, county records, Dallas
 * permits), so most of them are not on the knock list yet. The first action
 * on such a door adds it, dated by its hail, then records the action.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { addLightBasemap } from "@/lib/basemap";
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

const RED = "#d23a2f";
const ORANGE = "#e8871e";
const SLATE = "#8a919c";
const AMBER = "#c58a00";
const GREEN = "#0c7a40";
const GRAY = "#c3c8cf";

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
    case "appointment":
    case "job":
      return GREEN;
    case "come_back":
      return AMBER;
    case "no":
      return GRAY;
    default:
      return (d.hail_in ?? 0) >= 2.5 ? RED : (d.hail_in ?? 0) >= 2 ? ORANGE : SLATE;
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
        tone: "text-gray-500",
      };
    case "appointment":
      return { text: s.at ? `Inspection ${when(s.at)}` : "Inspection booked", tone: "font-semibold text-[#0c7a40]" };
    case "job":
      return { text: STAGE_LABEL[s.stage || ""] || "In the pipeline", tone: "font-semibold text-[#0c7a40]" };
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
    score: 0,
    lat: d.lat,
    lon: d.lon,
    phone: d.phone,
    county: d.county,
  };
}

type Mode = { kind: "near"; lat: number; lon: number; mi: number } | { kind: "zip"; zip: string };

export function FieldMap({ initialZip, initialBig }: { initialZip?: string; initialBig: boolean }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [big, setBig] = useState(initialBig);
  const [hideDone, setHideDone] = useState(true);
  const [onlyDue, setOnlyDue] = useState(false);
  const [doors, setDoors] = useState<Door[]>([]);
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
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ---- Loading -----------------------------------------------------------
  const load = useCallback(async (m: Mode, bigHail: boolean) => {
    setStatus("loading");
    setError("");
    setMode(m);
    const qs = new URLSearchParams();
    if (m.kind === "zip") qs.set("zip", m.zip);
    else {
      qs.set("near", `${m.lat.toFixed(5)},${m.lon.toFixed(5)}`);
      qs.set("mi", String(m.mi));
    }
    if (!bigHail) qs.set("big", "0");
    // Keep the URL shareable and reload-proof.
    const page = new URLSearchParams(window.location.search);
    if (m.kind === "zip") page.set("zip", m.zip);
    else page.delete("zip");
    if (!bigHail) page.set("big", "0");
    else page.delete("big");
    window.history.replaceState(null, "", `${window.location.pathname}${page.toString() ? `?${page}` : ""}`);
    try {
      const res = await fetch(`/api/field/doors?${qs}`);
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "Couldn't load doors.");
      setDoors(d.doors ?? []);
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
          load({ kind: "near", ...here, mi }, big);
        },
        () => setStatus("denied"),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    },
    [big, load],
  );

  useEffect(() => {
    if (initialZip) load({ kind: "zip", zip: initialZip }, initialBig);
    else locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = (bigHail = big) => {
    if (!mode) return locate();
    load(mode, bigHail);
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
      maxHail: Math.max(...list.map((d) => d.hail_in ?? 0)),
    }));
    return mode?.kind === "near"
      ? groups.sort((a, b) => a.nearest - b.nearest)
      : groups.sort((a, b) => b.open - a.open || b.maxHail - a.maxHail);
  }, [visible, mode]);

  const openCount = visible.filter((d) => !isDone(d.state)).length;

  // ---- Map ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      const L = (mod as any).default ?? mod;
      if (cancelled || !mapDiv.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapDiv.current, { zoomControl: true, attributionControl: true }).setView([32.78, -97.0], 10);
      addLightBasemap(L, map);
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
      L.circleMarker([d.lat, d.lon], {
        radius: isSel ? 10 : 6.5,
        color: isSel ? "#0b0e13" : hollow ? c : "#ffffff",
        weight: isSel ? 3 : hollow ? 2.5 : 1.5,
        fillColor: hollow ? "#ffffff" : c,
        fillOpacity: 1,
      })
        .on("click", () => selectDoor(d, false))
        .addTo(layer);
      pts.push([d.lat, d.lon]);
    }
    if (me) {
      L.circleMarker([me.lat, me.lon], { radius: 7, color: "#ffffff", weight: 3, fillColor: "#2b6cdf", fillOpacity: 1 }).addTo(layer);
    }
    if (!selected && pts.length) {
      map.fitBounds(L.latLngBounds(me ? [...pts, [me.lat, me.lon]] : pts), { padding: [24, 24], maxZoom: 17 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selected, me]);

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
            if (/^\d{5}$/.test(z)) load({ kind: "zip", zip: z }, big);
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
                onClick={() => me && load({ kind: "near", lat: me.lat, lon: me.lon, mi: m }, big)}
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
        <button
          onClick={() => {
            const next = !big;
            setBig(next);
            reload(next);
          }}
          className={chip(big)}
        >
          {big ? "2 in+ hail" : "All hail 1 in+"}
        </button>
        <button onClick={() => setHideDone((v) => !v)} className={chip(!hideDone)}>
          {hideDone ? "Show finished" : "Hide finished"}
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
                  ? `${openCount} door${openCount === 1 ? "" : "s"} to knock on ${streets.length} street${streets.length === 1 ? "" : "s"}${
                      mode?.kind === "zip" ? ` in ${mode.zip}` : mode?.kind === "near" ? `, within ${mode.mi === 0.5 ? "½" : mode.mi} mi` : ""
                    }`
                  : ""}
      </p>

      <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-4">
        {/* Map */}
        <div className="lg:sticky lg:top-[4.5rem] lg:self-start">
          <div ref={mapDiv} className="h-[42vh] w-full overflow-hidden rounded-xl border border-gray-200 lg:h-[calc(100vh-11rem)]" aria-label="Knock map" />
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
            {[
              [RED, "2.5 in+ hail"],
              [ORANGE, "2 to 2.5 in"],
              [AMBER, "Come back"],
              [GREEN, "Booked or in the pipeline"],
              [GRAY, "Said no"],
            ].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                {l}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: RED }} />
              Not home
            </span>
          </div>
        </div>

        {/* Streets */}
        <div className="mt-3 lg:mt-0">
          {status === "ready" && streets.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
              <p className="font-semibold">No {big ? "2 in+ hail " : ""}doors to knock here.</p>
              <p className="mt-1">
                {big ? "Try All hail, " : ""}
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
                        {g.open} to knock{g.place ? ` · ${g.place}` : ""} · up to {g.maxHail.toFixed(1)}″ hail
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {mode?.kind === "near" ? fmtMi(g.nearest) : ""} <span aria-hidden>{open ? "▾" : "▸"}</span>
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
                                    <span className="font-bold">{d.num}</span>
                                    {d.owner_name ? <span className="text-gray-600"> · {d.owner_name}</span> : null}
                                  </span>
                                  {d.hail_in != null && (
                                    <span className="shrink-0 text-sm font-bold" style={{ color: d.hail_in >= 2.5 ? RED : d.hail_in >= 2 ? "#b8650f" : SLATE }}>
                                      {d.hail_in.toFixed(1)}″
                                    </span>
                                  )}
                                </span>
                                <span className="mt-0.5 block text-xs text-gray-500">
                                  {[
                                    d.storm_date ? `Storm ${shortDay(d.storm_date)}` : null,
                                    d.absentee == null ? null : d.absentee ? "Owner lives elsewhere" : "Owner lives here",
                                    d.year_built ? `Built ${d.year_built}` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                                {st && <span className={`mt-0.5 block text-xs ${st.tone}`}>{st.text}</span>}
                              </span>
                            </button>

                            {sel && (
                              <div className="px-4 pb-4">
                                {(d.roof_note || d.wind_note) && (
                                  <ul className="mb-3 space-y-0.5 text-xs text-gray-600">
                                    {d.roof_note && <li>{d.roof_note}</li>}
                                    {d.wind_note && <li>{d.wind_note}</li>}
                                  </ul>
                                )}
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
