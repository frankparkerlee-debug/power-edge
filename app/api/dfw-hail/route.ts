import { NextResponse } from "next/server";

/**
 * DFW-wide hail activity for the homepage "live storm intelligence" band.
 * Same free NWS/IEM source as the address-level storm check, but metro-wide over
 * the last 12 months (no geocode). Cached daily. Powers a dynamic, proprietary-
 * feeling proof point that funnels into the per-address claim check.
 */

const WFO = "FWD"; // Fort Worth / Dallas weather office

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export async function GET() {
  const now = new Date();
  const ets = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setFullYear(now.getFullYear() - 1);
  const sts = start.toISOString().slice(0, 10);
  const url = `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?sts=${sts}T00:00Z&ets=${ets}T23:59Z&wfos=${WFO}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error("storm data failed");
    const data = await res.json();
    const feats = (data?.features ?? []) as Array<{
      properties: {
        typetext?: string;
        magf?: number | null;
        city?: string;
        valid?: string;
      };
    }>;

    let count = 0;
    let largest = 0;
    const cityCounts = new Map<string, number>();
    const events: { city: string; size: number; date: string }[] = [];

    for (const f of feats) {
      const p = f.properties;
      const size = p.magf ?? 0;
      if (!/HAIL/i.test(p.typetext || "") || !size) continue;
      count++;
      if (size > largest) largest = size;
      const city = titleCase(p.city || "");
      if (city) cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      events.push({ city, size, date: p.valid || "" });
    }

    events.sort((a, b) => (a.date < b.date ? 1 : -1));
    const topCities = [...cityCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([city, n]) => ({ city, count: n }));

    return NextResponse.json({
      ok: true,
      count,
      largest,
      topCities,
      recent: events.slice(0, 5),
      sinceMonths: 12,
    });
  } catch {
    return NextResponse.json({ ok: false, count: 0, topCities: [], recent: [] });
  }
}
