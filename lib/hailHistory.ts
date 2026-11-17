/**
 * Public hail history: National Weather Service hail reports for the North
 * Texas counties PowerEdge serves, grouped into storm days and per city.
 *
 * Source: NWS Local Storm Reports (spotters, emergency managers, the public,
 * mPING), pulled hourly from the Iowa Environmental Mesonet into storm_events
 * by lib/storm.ts. A report marks where hail was seen and how big, not every
 * street it fell on, so every page that uses this says "reported", never "hit".
 *
 * This is the one dataset no other DFW roofer publishes, which is why it
 * anchors the hail pages AI engines cite (/hail-reports and each city page).
 */
import { cities, type City } from "./cities";
import { haversineMi } from "./storm";

export const SERVICE_COUNTIES = [
  "Tarrant", "Dallas", "Denton", "Collin", "Parker", "Johnson",
  "Wise", "Rockwall", "Ellis", "Kaufman", "Hunt",
] as const;

/** Storm days worth their own page: claim-size hail, 1 inch or larger. */
export const PAGE_MIN_IN = 1;

/** How close a report has to be to a city's center to count as "near" it. */
export const NEAR_MI = 10;

export type HailReport = {
  valid_at: string;
  magnitude: number | null;
  city: string | null;
  county: string | null;
  lat: number;
  lon: number;
};

export type StormDay = {
  date: string; // YYYY-MM-DD, Central
  reports: number;
  maxIn: number;
  counties: string[];
  /** Towns with the largest reports first, de-duplicated. */
  towns: string[];
  biggestTown: string | null;
};

const CT = "America/Chicago";
export const centralDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: CT });

/** Hail reports in the service counties since `sinceIso`, newest first. Cached for 6 hours. */
export async function serviceAreaHail(sinceIso: string): Promise<HailReport[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const counties = SERVICE_COUNTIES.map((c) => `"${c}"`).join(",");
  try {
    const res = await fetch(
      `${url}/rest/v1/storm_events?select=valid_at,magnitude,city,county,lat,lon&type=eq.hail&valid_at=gte.${sinceIso}&county=in.(${encodeURIComponent(counties)})&order=valid_at.desc&limit=3000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 21600 } },
    );
    if (!res.ok) return [];
    return (await res.json()) as HailReport[];
  } catch {
    return [];
  }
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\bHil\b/, "Hills"); // IEM truncates "North Richland Hills"
}

/** Reports grouped by Central date, newest first. */
export function stormDays(reports: HailReport[]): StormDay[] {
  const by = new Map<string, HailReport[]>();
  for (const r of reports) {
    const d = centralDate(r.valid_at);
    const list = by.get(d);
    if (list) list.push(r);
    else by.set(d, [r]);
  }
  return [...by.entries()]
    .map(([date, rs]) => {
      const sorted = [...rs].sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0));
      const towns = [...new Set(sorted.map((r) => (r.city ? titleCase(r.city) : "")).filter(Boolean))];
      return {
        date,
        reports: rs.length,
        maxIn: sorted[0]?.magnitude ?? 0,
        counties: [...new Set(rs.map((r) => r.county ?? "").filter(Boolean))].sort(),
        towns,
        biggestTown: towns[0] ?? null,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export type CityHail = {
  city: City;
  days: StormDay[]; // days with a report within NEAR_MI, newest first
  last: StormDay | null;
  biggest: StormDay | null;
};

/** Storm days with a report within NEAR_MI of one city's center. */
export function hailNear(city: City, reports: HailReport[]): CityHail {
  const near = reports.filter((r) => haversineMi(city.lat, city.lon, r.lat, r.lon) <= NEAR_MI);
  const days = stormDays(near);
  const biggest = days.reduce<StormDay | null>((m, d) => (!m || d.maxIn > m.maxIn ? d : m), null);
  return { city, days, last: days[0] ?? null, biggest };
}

export function allCitiesHail(reports: HailReport[]) {
  return cities.map((c) => hailNear(c, reports));
}

/** "1.75″" with the common name when there is one. */
export function stoneSize(inches: number) {
  const names: Record<string, string> = {
    "0.75": "penny", "0.88": "nickel", "1": "quarter", "1.25": "half dollar",
    "1.5": "ping pong ball", "1.75": "golf ball", "2": "hen egg", "2.5": "tennis ball",
    "2.75": "baseball", "3": "teacup", "4": "grapefruit", "4.5": "softball",
  };
  const n = names[String(inches)];
  return `${inches}″${n ? ` (${n})` : ""}`;
}

export function niceDay(date: string, withYear = true) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/** Midnight Central, 12 months ago, as an ISO string: the window the city pages show. */
export function twelveMonthsAgo(now = new Date()) {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString();
}

/** N days ago, as an ISO string. */
export function daysAgo(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 86400000).toISOString();
}
