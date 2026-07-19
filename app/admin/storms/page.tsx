import type { Metadata } from "next";
import { listStormEvents, type StormEventRow } from "@/lib/storm";
import { solarPermitStats } from "@/lib/solarPermits";
import { listRoofChecks } from "@/lib/db";
import { StormDashboard, type DashSolarZip } from "@/components/StormDashboard";
import { listStormTargets, listTargetDays, listTargetCities } from "@/lib/parcels";

/** Zip centroid via zippopotam.us (free, cached 30 days) — powers the solar
 *  density overlay without geocoding 20k permit addresses. */
async function zipCentroid(zip: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      next: { revalidate: 2592000 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const p = j?.places?.[0];
    if (!p) return null;
    return { lat: parseFloat(p.latitude), lon: parseFloat(p.longitude) };
  } catch {
    return null;
  }
}

// Storm engine command view — NOT indexed. Gated by ?key=<ADMIN_TOKEN>, same
// pattern as /admin/leads. Shows storm days (100mi radius), the solar-permit
// target inventory, and self-identified claim-check addresses (knock gold).
export const metadata: Metadata = {
  title: "Storm Engine",
  robots: { index: false, follow: false },
};

type StormDay = {
  date: string;
  hail: number;
  maxHail: number;
  gusts: number;
  maxGust: number;
  windDmg: number;
  cities: string[];
};

function clusterByDay(events: StormEventRow[]): StormDay[] {
  const days = new Map<string, StormDay>();
  for (const e of events) {
    const date = e.valid_at.slice(0, 10);
    let d = days.get(date);
    if (!d) {
      d = { date, hail: 0, maxHail: 0, gusts: 0, maxGust: 0, windDmg: 0, cities: [] };
      days.set(date, d);
    }
    if (e.type === "hail") {
      d.hail++;
      if ((e.magnitude ?? 0) > d.maxHail) d.maxHail = e.magnitude ?? 0;
    } else if (e.type === "wind_gust") {
      d.gusts++;
      if ((e.magnitude ?? 0) > d.maxGust) d.maxGust = e.magnitude ?? 0;
    } else {
      d.windDmg++;
    }
    if (e.city && !d.cities.includes(e.city) && d.cities.length < 6) d.cities.push(e.city);
  }
  return [...days.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

function fmtDate(iso: string) {
  try {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function AdminStormsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; targets?: string; county?: string; city?: string }>;
}) {
  const { key, targets: targetDate, county, city } = await searchParams;
  const adminToken = process.env.ADMIN_TOKEN;
  const authed = !!adminToken && key === adminToken;

  const wrap = "min-h-screen bg-white px-6 py-10 text-[#0b0e13]";

  if (!authed) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">Storm Engine</h1>
          <p className="mt-1 text-sm text-gray-600">Enter your access key.</p>
          <form method="get" className="mt-4 flex gap-2">
            <input
              name="key"
              type="password"
              placeholder="Access key"
              className="flex-1 rounded-md border border-gray-300 px-4 py-2.5"
              autoFocus
            />
            <button
              type="submit"
              className="rounded-md bg-[#0b0e13] px-5 py-2.5 font-display font-bold text-white"
            >
              View
            </button>
          </form>
        </div>
      </div>
    );
  }

  const safeTargetDate =
    targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : undefined;
  const safeCounty = county && /^[a-z]{3,20}$/.test(county) ? county : undefined;
  const safeCity = city && /^[A-Za-z .'-]{2,40}$/.test(city) ? city : undefined;
  const [events, solar, checks, targetDays, topTargets, targetCities] = await Promise.all([
    listStormEvents(90),
    solarPermitStats(40),
    listRoofChecks(40),
    listTargetDays(),
    listStormTargets({ date: safeTargetDate, county: safeCounty, city: safeCity }, 100),
    listTargetCities(),
  ]);
  const solarZips: DashSolarZip[] = await Promise.all(
    solar.topZips.map(async (z) => ({ ...z, ...((await zipCentroid(z.zip)) ?? { lat: null, lon: null }) })),
  );
  const days = clusterByDay(events);
  const bigDays = days.filter((d) => d.maxHail >= 1 || d.maxGust >= 60 || d.windDmg >= 3);

  return (
    <div className={wrap}>
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between border-b border-gray-200 pb-4">
          <h1 className="font-display text-2xl font-extrabold">
            Storm Engine{" "}
            <span className="text-base font-semibold text-gray-500">
              100mi radius · last 90 days
            </span>
          </h1>
          <a href={`/admin/leads?key=${key}`} className="text-sm text-[#0c7a40] hover:underline">
            Leads →
          </a>
        </div>

        {/* Summary chips */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { n: days.length, label: "storm days" },
            { n: bigDays.length, label: "major days (1″+ hail / 60+ gust)" },
            { n: events.filter((e) => e.type === "hail").length, label: "hail reports" },
            { n: solar.total, label: "solar homes on file (Dallas + Fort Worth permits)" },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-gray-200 p-4">
              <div className="font-display text-2xl font-extrabold">{c.n}</div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Map + timeline */}
        <StormDashboard
          events={events.map((e) => ({
            valid_at: e.valid_at,
            type: e.type,
            magnitude: e.magnitude,
            city: e.city,
            lat: e.lat,
            lon: e.lon,
          }))}
          solarZips={solarZips}
          checks={checks.map((c) => ({
            address: c.address || c.matched || "",
            lat: c.lat ?? null,
            lon: c.lon ?? null,
            largest_in: c.largest_in ?? null,
            qualifies: c.qualifies ?? null,
          }))}
        />

        {/* Storm days */}
        <h2 className="mt-10 font-display text-lg font-extrabold">Storm days</h2>
        {days.length === 0 ? (
          <p className="mt-2 text-gray-600">
            No storm reports ingested yet — the hourly cron fills this, or run a
            backfill: <code className="rounded bg-gray-100 px-1">POST /api/cron/storm-watch?days=365</code>
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Hail reports</th>
                  <th className="py-2 pr-4">Max hail</th>
                  <th className="py-2 pr-4">Severe gusts</th>
                  <th className="py-2 pr-4">Max gust</th>
                  <th className="py-2 pr-4">Wind damage</th>
                  <th className="py-2 pr-4">Areas hit</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const major = d.maxHail >= 1 || d.maxGust >= 60 || d.windDmg >= 3;
                  return (
                    <tr
                      key={d.date}
                      className={`border-b border-gray-100 ${major ? "bg-amber-50" : ""}`}
                    >
                      <td className="whitespace-nowrap py-2.5 pr-4 font-semibold">
                        {fmtDate(d.date)} {major && "⚡"}
                      </td>
                      <td className="py-2.5 pr-4">{d.hail || "—"}</td>
                      <td className="py-2.5 pr-4 font-semibold">
                        {d.maxHail ? `${d.maxHail}″` : "—"}
                      </td>
                      <td className="py-2.5 pr-4">{d.gusts || "—"}</td>
                      <td className="py-2.5 pr-4">{d.maxGust ? `${d.maxGust} mph` : "—"}</td>
                      <td className="py-2.5 pr-4">{d.windDmg || "—"}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{d.cities.join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Homeowner targets */}
        <h2 className="mt-10 font-display text-lg font-extrabold">
          Homeowner targets{" "}
          <span className="text-sm font-semibold text-gray-500">
            named owners at addresses inside the hail footprint · Dallas (DCAD) + Tarrant (TAD)
          </span>
        </h2>
        {targetDays.length === 0 ? (
          <p className="mt-2 text-gray-600">
            None generated yet — auto-runs on fresh hail days, or backfill one:{" "}
            <code className="rounded bg-gray-100 px-1">
              POST /api/cron/storm-watch?targets=YYYY-MM-DD
            </code>
          </p>
        ) : (
          (() => {
            const qs = (over: Record<string, string | undefined>) => {
              const p = new URLSearchParams({ key: key || "" });
              const merged = {
                targets: safeTargetDate,
                county: safeCounty,
                city: safeCity,
                ...over,
              };
              for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
              return `/admin/storms?${p}`;
            };
            const chip = (active: boolean) =>
              `rounded-full border px-3 py-1.5 text-sm ${
                active ? "border-[#0b0e13] bg-[#0b0e13] text-white" : "border-gray-200"
              }`;
            const cities = targetCities.filter((c) => !safeCounty || c.county === safeCounty);
            return (
              <>
                {/* Day chips */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={qs({ targets: undefined })} className={chip(!safeTargetDate)}>
                    All days
                  </a>
                  {targetDays.map((d) => (
                    <a
                      key={d.storm_date}
                      href={qs({ targets: d.storm_date })}
                      className={chip(safeTargetDate === d.storm_date)}
                    >
                      {d.storm_date} · {d.targets}
                      {d.solar_targets ? ` (☀️${d.solar_targets})` : ""}
                    </a>
                  ))}
                </div>
                {/* County + city filters — counties appear once they have targets */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a
                    href={qs({ county: undefined, city: undefined })}
                    className={chip(!safeCounty && !safeCity)}
                  >
                    All counties
                  </a>
                  {[...new Set(targetCities.map((c) => c.county).filter(Boolean))].sort().map((co) => (
                    <a
                      key={co}
                      href={qs({ county: co, city: undefined })}
                      className={chip(safeCounty === co)}
                    >
                      {co.charAt(0).toUpperCase() + co.slice(1)} County
                    </a>
                  ))}
                  <form method="get" action="/admin/storms" className="flex items-center gap-1.5">
                    <input type="hidden" name="key" value={key} />
                    {safeTargetDate && <input type="hidden" name="targets" value={safeTargetDate} />}
                    {safeCounty && <input type="hidden" name="county" value={safeCounty} />}
                    <select
                      name="city"
                      defaultValue={safeCity || ""}
                      className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                    >
                      <option value="">All cities</option>
                      {cities.map((c) => (
                        <option key={`${c.county}-${c.city}`} value={c.city}>
                          {c.city} ({c.targets})
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold"
                    >
                      Filter
                    </button>
                  </form>
                  <a
                    href={`/api/admin/storm-targets?key=${key}${
                      safeTargetDate ? `&date=${safeTargetDate}` : ""
                    }${safeCounty ? `&county=${safeCounty}` : ""}${
                      safeCity ? `&city=${encodeURIComponent(safeCity)}` : ""
                    }&format=csv`}
                    className="rounded-full bg-[#0c7a40] px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    ⬇ CSV for dialer / skip trace
                  </a>
                </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-4">Score</th>
                    <th className="py-2 pr-4">Owner</th>
                    <th className="py-2 pr-4">Address</th>
                    <th className="py-2 pr-4">City</th>
                    <th className="py-2 pr-4">Zip</th>
                    <th className="py-2 pr-4">Hail</th>
                    <th className="py-2 pr-4">Solar</th>
                    <th className="py-2 pr-4">Occupancy</th>
                    <th className="py-2 pr-4">Built</th>
                    <th className="py-2 pr-4">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {topTargets.map((t) => (
                    <tr key={t.id} className={`border-b border-gray-100 ${t.solar ? "bg-green-50" : ""}`}>
                      <td className="py-2 pr-4 font-bold">{t.score}</td>
                      <td className="py-2 pr-4 font-semibold">{t.owner_name}</td>
                      <td className="whitespace-nowrap py-2 pr-4">{t.address}</td>
                      <td className="whitespace-nowrap py-2 pr-4">{t.city || "—"}</td>
                      <td className="py-2 pr-4">{t.zip}</td>
                      <td className="py-2 pr-4">{t.hail_size_in ? `${t.hail_size_in}″` : "—"}</td>
                      <td className="py-2 pr-4">{t.solar ? "☀️" : ""}</td>
                      <td className="py-2 pr-4 text-gray-600">
                        {t.absentee ? "Absentee/investor" : "Owner-occupied"}
                      </td>
                      <td className="py-2 pr-4">{t.year_built ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {t.value ? `$${Math.round(t.value / 1000)}k` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-gray-500">
                Top 100 by score{safeTargetDate ? ` for ${safeTargetDate}` : " across all storm days"}
                {safeCounty ? ` · ${safeCounty === "dallas" ? "Dallas" : "Tarrant"} County` : ""}
                {safeCity ? ` · ${safeCity}` : ""}. Full list in the CSV. Phones come from batch
                skip trace (upload the CSV to BatchData or similar, then DNC-scrub before dialing).
              </p>
            </div>
          </>
            );
          })()
        )}

        {/* Solar inventory */}
        <h2 className="mt-10 font-display text-lg font-extrabold">
          Solar target inventory{" "}
          <span className="text-sm font-semibold text-gray-500">
            {solar.total} permit-confirmed homes · priority-one after any hail day
          </span>
        </h2>
        {solar.topZips.length === 0 ? (
          <p className="mt-2 text-gray-600">
            No permits synced yet — runs nightly, or force it:{" "}
            <code className="rounded bg-gray-100 px-1">POST /api/cron/storm-watch?solar=1</code>
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {solar.topZips.map((z) => (
              <span
                key={z.zip}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-sm"
              >
                <span className="font-semibold">{z.zip}</span>{" "}
                <span className="text-gray-500">· {z.permits} homes</span>
              </span>
            ))}
          </div>
        )}

        {/* Knock gold */}
        <h2 className="mt-10 font-display text-lg font-extrabold">
          Self-checked addresses{" "}
          <span className="text-sm font-semibold text-gray-500">
            ran the claim check — knock/dial first
          </span>
        </h2>
        {checks.length === 0 ? (
          <p className="mt-2 text-gray-600">Nothing captured yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Address</th>
                  <th className="py-2 pr-4">Hail events</th>
                  <th className="py-2 pr-4">Largest</th>
                  <th className="py-2 pr-4">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="whitespace-nowrap py-2.5 pr-4 text-gray-500">
                      {new Date(c.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-2.5 pr-4 font-semibold">{c.address || c.matched || "—"}</td>
                    <td className="py-2.5 pr-4">{c.hail_count ?? "—"}</td>
                    <td className="py-2.5 pr-4">{c.largest_in ? `${c.largest_in}″` : "—"}</td>
                    <td className="py-2.5 pr-4">
                      {c.qualifies ? (
                        <span className="font-semibold text-[#0c7a40]">Likely qualifies</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
          Phase 1b adds: parcel intersect (owner names from county CAD rolls),
          batch skip trace, DNC scrub, and per-storm scored target lists pushed
          to HubSpot. Cold outreach = knock + manual dial only — no cold texts,
          no AI cold calls (TCPA).
        </p>
      </div>
    </div>
  );
}
