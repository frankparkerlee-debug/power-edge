import { createHmac } from "node:crypto";
import { sendMail } from "@/lib/sendMail";
import { site } from "@/lib/site";

/**
 * Storm alerts: when the National Weather Service warns for hail or a tornado
 * over a signed-up home or an open job, the team hears about it within
 * minutes and the homeowner gets a heads-up the same night.
 *
 * Why warnings and not storm reports: spotter reports reach the feed a median
 * 40 minutes after the hail and sometimes hours later. Warning polygons are
 * published within a minute or two, before the hail lands. Chasers buy hail
 * maps that are just as fast, so speed alone is not the edge. The edge is that
 * these homeowners already know us and asked to hear from us.
 *
 * Source: Iowa Environmental Mesonet storm-based warnings (same feed family as
 * the hourly storm reports), FWD office, which covers all 11 counties.
 */

const FEED = "https://mesonet.agron.iastate.edu/geojson/sbw.geojson";
// The 11 counties, same box the house scoring uses.
const BOX = { south: 31.9, north: 33.55, west: -98.15, east: -95.75 };
const MIN_HAIL_IN = 1;
const MIN_WIND_MPH = 70;
/** A home hears from us at most once in this window, however many warnings. */
const QUIET_HOURS = 12;

type Ring = [number, number][]; // [lon, lat]
type Geometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

export type Warning = {
  id: string; // VTEC event key, e.g. 2026-FWD-SV-0070
  phenomena: "SV" | "TO";
  eventid: number;
  issued_at: string;
  expires_at: string;
  hail_in: number | null;
  wind_mph: number | null;
  tornado: string | null;
  polygons: Geometry[]; // every polygon segment seen for this event
};

type Home = {
  kind: "signup" | "job";
  ref_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string;
  lat: number;
  lon: number;
};

/* ---------------- geometry ---------------- */

function inRing(lat: number, lon: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Point in a GeoJSON polygon (outer ring minus holes) or multipolygon. */
export function inGeometry(lat: number, lon: number, g: Geometry) {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some(
    (rings) => inRing(lat, lon, rings[0]) && !rings.slice(1).some((hole) => inRing(lat, lon, hole)),
  );
}

function touchesBox(g: Geometry) {
  const pts = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).flat(2) as [number, number][];
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return !(
    Math.max(...lats) < BOX.south ||
    Math.min(...lats) > BOX.north ||
    Math.max(...lons) < BOX.west ||
    Math.min(...lons) > BOX.east
  );
}

function centroid(g: Geometry): { lat: number; lon: number } {
  const ring = g.type === "Polygon" ? g.coordinates[0] : g.coordinates[0][0];
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  return { lat, lon };
}

/* ---------------- feed ---------------- */

/** Qualifying warnings over the 11 counties. Pass sts/ets (ISO) to replay a past window. */
export async function fetchWarnings(window?: { sts: string; ets: string }): Promise<Warning[]> {
  const q = new URLSearchParams({ wfos: "FWD" });
  if (window) {
    q.set("sts", window.sts);
    q.set("ets", window.ets);
  }
  const res = await fetch(`${FEED}?${q}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`warning feed ${res.status}`);
  const data = (await res.json()) as {
    features?: Array<{
      geometry: Geometry | null;
      properties: {
        phenomena: string;
        significance: string;
        eventid: number;
        year: number;
        wfo: string;
        issue: string;
        expire: string;
        hailtag: number | null;
        windtag: number | null;
        tornadotag: string | null;
      };
    }>;
  };

  const byId = new Map<string, Warning>();
  for (const f of data.features ?? []) {
    const p = f.properties;
    if (!f.geometry || p.significance !== "W") continue;
    if (p.phenomena !== "SV" && p.phenomena !== "TO") continue;
    const qualifies =
      p.phenomena === "TO" || (p.hailtag ?? 0) >= MIN_HAIL_IN || (p.windtag ?? 0) >= MIN_WIND_MPH;
    if (!qualifies || !touchesBox(f.geometry)) continue;

    const id = `${p.year}-${p.wfo}-${p.phenomena}-${String(p.eventid).padStart(4, "0")}`;
    const w = byId.get(id) ?? {
      id,
      phenomena: p.phenomena as "SV" | "TO",
      eventid: p.eventid,
      issued_at: p.issue,
      expires_at: p.expire,
      hail_in: null,
      wind_mph: null,
      tornado: null,
      polygons: [],
    };
    w.hail_in = Math.max(w.hail_in ?? 0, p.hailtag ?? 0) || null;
    w.wind_mph = Math.max(w.wind_mph ?? 0, p.windtag ?? 0) || null;
    w.tornado = w.tornado ?? p.tornadotag ?? (p.phenomena === "TO" ? "WARNED" : null);
    if (p.expire > w.expires_at) w.expires_at = p.expire;
    w.polygons.push(f.geometry);
    byId.set(id, w);
  }
  return [...byId.values()];
}

/* ---------------- database ---------------- */

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
const rest = (path: string) => `${process.env.SUPABASE_URL}/rest/v1/${path}`;

async function loadHomes(): Promise<Home[]> {
  const [s, j] = await Promise.all([
    fetch(rest("alert_signups?select=id,name,phone,email,address,lat,lon&opted_out_at=is.null&lat=not.is.null"), {
      headers: db(),
      cache: "no-store",
    }),
    fetch(rest("jobs?select=id,owner_name,phone,email,address,lat,lon,stage&lat=not.is.null&stage=neq.lost"), {
      headers: db(),
      cache: "no-store",
    }),
  ]);
  const signups = s.ok
    ? ((await s.json()) as Array<{ id: string; name: string; phone: string; email: string | null; address: string; lat: number; lon: number }>)
    : [];
  const jobs = j.ok
    ? ((await j.json()) as Array<{ id: string; owner_name: string | null; phone: string | null; email: string | null; address: string; lat: number; lon: number }>)
    : [];
  return [
    ...signups.map((r) => ({ kind: "signup" as const, ref_id: r.id, name: r.name, phone: r.phone, email: r.email, address: r.address, lat: r.lat, lon: r.lon })),
    ...jobs.map((r) => ({ kind: "job" as const, ref_id: r.id, name: r.owner_name, phone: r.phone, email: r.email, address: r.address, lat: r.lat, lon: r.lon })),
  ];
}

/* ---------------- messages ---------------- */

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

function warningLine(w: Warning) {
  const kind = w.phenomena === "TO" ? "Tornado warning" : "Severe thunderstorm warning";
  const bits = [
    w.hail_in ? `hail up to ${w.hail_in.toFixed(2)} in` : null,
    w.wind_mph ? `wind to ${w.wind_mph} mph` : null,
  ].filter(Boolean);
  return `${kind}${bits.length ? `, ${bits.join(", ")}` : ""}, until ${fmtTime(w.expires_at)}`;
}

/** Signed link that opts a signup out, for emails now and texts later. */
export function stopToken(id: string) {
  return createHmac("sha256", process.env.ADMIN_TOKEN || "storm-alerts").update(`stop:${id}`).digest("hex").slice(0, 32);
}
export const stopUrl = (id: string) => `${site.url}/api/storm-alerts/stop?id=${id}&s=${stopToken(id)}`;

/** The text a homeowner gets. Kept under two SMS segments. */
export function textBody(w: Warning) {
  const what = w.phenomena === "TO" ? "A tornado warning" : `A hail warning${w.hail_in ? ` (up to ${w.hail_in.toFixed(2)} in)` : ""}`;
  return (
    `PowerEdge storm alert: ${what} covers your street until ${fmtTime(w.expires_at)}. ` +
    `Don't sign with anyone tonight. Want a free roof check tomorrow? Reply YES. Reply STOP to opt out.`
  );
}

/**
 * Send a storm-alert text. No text provider is connected yet, so this records
 * that nothing went out. Wire the provider here and nowhere else.
 */
async function sendText(phone: string, body: string): Promise<"sent" | "failed" | "no_provider"> {
  void phone;
  void body;
  return "no_provider";
}

async function emailHomeowner(h: Home, w: Warning): Promise<"sent" | "failed" | "none"> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !h.email) return "none";
  const what = w.phenomena === "TO" ? "a tornado warning" : `a hail warning${w.hail_in ? ` (hail up to ${w.hail_in.toFixed(2)} in)` : ""}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;color:#0b0e13;line-height:1.5">
      <p style="font-size:16px"><b>Storm alert for ${h.address}</b></p>
      <p>The National Weather Service just issued ${what} that covers your street, until ${fmtTime(w.expires_at)}.</p>
      <p>Two things worth knowing tonight:</p>
      <ul>
        <li>Don't sign anything with a contractor who knocks tonight or tomorrow. A real roof check can wait for daylight.</li>
        <li>If you'd like us to look at your roof tomorrow, call or text ${site.phone}. It's free.</li>
      </ul>
      <p>PowerEdge &middot; ${site.phone}</p>
      <p style="font-size:12px;color:#6b7280">You asked for storm alerts at this address.
        <a href="${stopUrl(h.ref_id)}" style="color:#6b7280">Stop storm alerts</a>.
        ${site.legalEntity}, ${site.mailingAddress}</p>
    </div>`;
  const r = await sendMail({
    resendKey: key,
    kind: "storm_alert",
    from: `PowerEdge <hello@${site.domain}>`,
    to: h.email,
    subject: w.phenomena === "TO" ? "Tornado warning for your street" : "Hail warning for your street tonight",
    html,
  });
  return r.ok ? "sent" : "failed";
}

/**
 * One email per check, and only when homes of ours are newly inside a
 * warning. A busy storm night can carry 25+ warnings; the team should hear
 * about the ones that touch our people, and see the rest on /admin/alerts.
 */
async function emailTeam(groups: Array<{ w: Warning; hits: Home[] }>) {
  const key = process.env.RESEND_API_KEY;
  if (!key || groups.length === 0) return false;
  const row = (h: Home) =>
    `<tr><td style="padding:4px 8px">${h.kind === "job" ? "Open job" : "Signed up"}</td>` +
    `<td style="padding:4px 8px">${h.name ?? ""}</td><td style="padding:4px 8px">${h.address}</td>` +
    `<td style="padding:4px 8px">${h.phone ?? ""}</td></tr>`;
  const sections = groups
    .map(({ w, hits }) => {
      const c = centroid(w.polygons[w.polygons.length - 1]);
      const doors = `${site.url}/admin/doors?near=${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
      return `
        <p style="margin-top:18px;font-size:15px"><b>${warningLine(w)}</b></p>
        <table style="border-collapse:collapse;font-size:14px">${hits.map(row).join("")}</table>
        <p style="margin-top:6px"><a href="${doors}">Best doors in this warning</a></p>`;
    })
    .join("");
  const total = groups.reduce((n, g) => n + g.hits.length, 0);
  const biggest = Math.max(...groups.map((g) => g.w.hail_in ?? 0));
  const tornado = groups.some((g) => g.w.phenomena === "TO");
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;color:#0b0e13;line-height:1.5">
      <p>${total} of ours ${total === 1 ? "is" : "are"} inside a National Weather Service warning right now.
        Signed-up homeowners got a heads-up. Plan tomorrow's first doors around them.</p>
      ${sections}
      <p style="margin-top:18px"><a href="${site.url}/admin/alerts">All storm alerts</a></p>
    </div>`;
  const r = await sendMail({
    resendKey: key,
    kind: "storm_team",
    from: `PowerEdge Storm Watch <leads@${site.domain}>`,
    to: site.email,
    subject: `${tornado ? "Tornado/hail" : "Hail"} warning: ${total} of ours inside${biggest ? `, hail to ${biggest.toFixed(2)} in` : ""}`,
    html,
  });
  return r.ok;
}

/* ---------------- the run ---------------- */

export type RunResult = {
  ok: boolean;
  warnings: number;
  newHits: number;
  teamEmails: number;
  homeownerEmails: number;
  detail: Array<{ id: string; line: string; hits: Array<{ kind: string; address: string }> }>;
  error?: string;
};

/**
 * One pass: read warnings, find homes inside, record new hits, notify.
 * dry=true computes everything and writes or sends nothing (for replaying a
 * past storm to check the logic).
 */
export async function runStormWarnings(
  opts: {
    dry?: boolean;
    window?: { sts: string; ets: string };
    /** Extra points to test against the warnings (dry runs only). */
    testPoints?: Array<{ lat: number; lon: number; label: string }>;
  } = {},
): Promise<RunResult> {
  const out: RunResult = { ok: true, warnings: 0, newHits: 0, teamEmails: 0, homeownerEmails: 0, detail: [] };
  const dbOn = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!dbOn && !opts.dry) return { ...out, ok: false, error: "database not connected" };
  try {
    const warnings = await fetchWarnings(opts.window);
    out.warnings = warnings.length;
    if (warnings.length === 0) return out;

    const tests: Home[] = opts.dry
      ? (opts.testPoints ?? []).map((p, i) => ({
          kind: "signup" as const, ref_id: `test-${i}`, name: "Test point", phone: null, email: null,
          address: p.label, lat: p.lat, lon: p.lon,
        }))
      : [];
    const homes = [...(dbOn ? await loadHomes() : []), ...tests];
    if (!dbOn) {
      for (const w of warnings) {
        const inside = homes.filter((h) => w.polygons.some((g) => inGeometry(h.lat, h.lon, g)));
        out.detail.push({ id: w.id, line: warningLine(w), hits: inside.map((h) => ({ kind: h.kind, address: h.address })) });
        out.newHits += inside.length;
      }
      return out;
    }

    const ids = warnings.map((w) => w.id);
    const [hitRes, recentRes] = await Promise.all([
      fetch(rest(`storm_warning_hits?select=warning_id,kind,ref_id&warning_id=in.(${ids.map((i) => `"${i}"`).join(",")})`), { headers: db(), cache: "no-store" }),
      fetch(rest(`storm_warning_hits?select=ref_id&kind=eq.signup&created_at=gte.${new Date(Date.now() - QUIET_HOURS * 3600e3).toISOString()}`), { headers: db(), cache: "no-store" }),
    ]);
    const already = new Set(((hitRes.ok ? await hitRes.json() : []) as Array<{ warning_id: string; kind: string; ref_id: string }>).map((r) => `${r.warning_id}|${r.kind}|${r.ref_id}`));
    const recentlyAlerted = new Set(((recentRes.ok ? await recentRes.json() : []) as Array<{ ref_id: string }>).map((r) => r.ref_id));

    const forTeam: Array<{ w: Warning; hits: Home[] }> = [];
    for (const w of warnings) {
      const inside = homes.filter((h) => w.polygons.some((g) => inGeometry(h.lat, h.lon, g)));
      const fresh = inside.filter((h) => !already.has(`${w.id}|${h.kind}|${h.ref_id}`));
      out.detail.push({ id: w.id, line: warningLine(w), hits: inside.map((h) => ({ kind: h.kind, address: h.address })) });
      out.newHits += fresh.length;
      if (opts.dry) continue;

      // The warning itself (polygon updates fold into one row).
      await fetch(rest("storm_warnings?on_conflict=id"), {
        method: "POST",
        headers: { ...db(), Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{
          id: w.id, phenomena: w.phenomena, eventid: w.eventid, issued_at: w.issued_at,
          expires_at: w.expires_at, hail_in: w.hail_in, wind_mph: w.wind_mph, tornado: w.tornado,
          polygon: w.polygons[w.polygons.length - 1], last_seen_at: new Date().toISOString(),
        }]),
      });

      // Homeowner messages first, so each hit row records what went out.
      const rows = [];
      for (const h of fresh) {
        let email_status: string | null = null;
        let text_status: string | null = null;
        if (h.kind === "signup") {
          if (recentlyAlerted.has(h.ref_id)) {
            email_status = "skipped";
            text_status = "skipped";
          } else {
            email_status = await emailHomeowner(h, w);
            if (email_status === "sent") out.homeownerEmails++;
            text_status = h.phone ? await sendText(h.phone, textBody(w)) : "none";
            recentlyAlerted.add(h.ref_id);
          }
        }
        rows.push({
          warning_id: w.id, kind: h.kind, ref_id: h.ref_id, name: h.name, phone: h.phone,
          email: h.email, address: h.address, lat: h.lat, lon: h.lon, email_status, text_status,
        });
      }
      if (rows.length) {
        await fetch(rest("storm_warning_hits?on_conflict=warning_id,kind,ref_id"), {
          method: "POST",
          headers: { ...db(), Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify(rows),
        });
      }

      if (fresh.length > 0) forTeam.push({ w, hits: fresh });
    }

    // One digest for this check, only for homes newly inside a warning.
    if (!opts.dry && (await emailTeam(forTeam))) {
      out.teamEmails = 1;
      const alerted = forTeam.map((g) => `"${g.w.id}"`).join(",");
      await fetch(rest(`storm_warnings?id=in.(${alerted})`), {
        method: "PATCH",
        headers: { ...db(), Prefer: "return=minimal" },
        body: JSON.stringify({ team_alerted_at: new Date().toISOString() }),
      });
    }
    return out;
  } catch (e) {
    return { ...out, ok: false, error: (e as Error).message };
  }
}
