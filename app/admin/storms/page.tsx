import type { Metadata } from "next";
import { listStormEvents, type StormEventRow } from "@/lib/storm";
import { solarPermitStats } from "@/lib/solarPermits";
import { listRoofChecks } from "@/lib/db";

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
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
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

  const [events, solar, checks] = await Promise.all([
    listStormEvents(90),
    solarPermitStats(),
    listRoofChecks(40),
  ]);
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
            { n: solar.total, label: "solar homes on file (Dallas permits)" },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-gray-200 p-4">
              <div className="font-display text-2xl font-extrabold">{c.n}</div>
              <div className="text-xs uppercase tracking-wide text-gray-500">{c.label}</div>
            </div>
          ))}
        </div>

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
