import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listStormEvents, localDay, type StormEventRow } from "@/lib/storm";
import { listRoofChecks } from "@/lib/db";
import { StormDashboard } from "@/components/StormDashboard";
import { listStormTargets, listTargetDays, listTargetCities, withLastKnock, areasForRep, BIG_HAIL_IN } from "@/lib/parcels";
import { TargetCards } from "@/components/TargetCards";
import { currentUser } from "@/lib/auth";

// Storm engine command view, NOT indexed. requires a signed-in team member, same
// pattern as /admin/leads. Shows storm days (100mi radius), scored homeowner
// targets, and self-identified claim-check addresses (knock gold).
export const metadata: Metadata = {
  title: "Storm office view",
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
    const date = localDay(e.valid_at);
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
  searchParams: Promise<{
    key?: string;
    targets?: string;
    county?: string;
    city?: string;
    days?: string;
    rep?: string;
    big?: string;
    zip?: string;
  }>;
}) {
  const { key, targets: targetDate, county, city, days: daysParam, rep, big, zip } = await searchParams;
  const user = await currentUser(key);
  // The office view: storm tables, every filter and the homeowner export.
  // Reps work from the knock map at /admin/storms.
  if (user && user.role !== "admin") redirect("/admin/storms");
  const authed = !!user;

  const wrap = "min-h-screen bg-white px-4 py-6 text-[#0b0e13] sm:px-6 sm:py-10";

  if (!authed) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">Storm Engine</h1>
          <p className="mt-2 text-sm text-gray-600">
            This is the knock tool.{" "}
            <a href="/login" className="font-semibold text-[#0c7a40] underline">
              Sign in
            </a>{" "}
            with your work email and it opens on your own territory.
          </p>
        </div>
      </div>
    );
  }

  const safeTargetDate =
    targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : undefined;
  const safeCounty = county && /^[a-z]{3,20}$/.test(county) ? county : undefined;
  const safeCity = city && /^[A-Za-z .'-]{2,40}$/.test(city) ? city : undefined;
  const safeDays = ["10", "30", "90"].includes(daysParam || "") ? Number(daysParam) : undefined;
  // Field default: only doors with 2 in+ radar hail at the house, the level
  // that showed real re-roofing in the Dallas permit test. big=0 shows all.
  const bigHail = big !== "0";
  const safeZip = zip && /^\d{5}$/.test(zip.trim()) ? zip.trim() : undefined;
  // A rep opening their own link lands on their own territory. Without this,
  // every rep opens the same top-of-list and three of them knock one street.
  // Identity comes from the session. ?rep= is still honoured for an admin
  // looking at someone else's board, but a rep can no longer claim to be
  // another rep by editing the URL.
  const typed = rep && /^[\w .'-]{2,40}$/.test(rep) ? rep : undefined;
  const safeRep = user?.role === "admin" ? (typed ?? user?.name) : (user?.name || typed);
  const myAreas = safeRep ? await areasForRep(safeRep) : [];
  const myCities = myAreas.filter((a) => a.area_kind === "city").map((a) => a.area_value);
  // A ZIP the rep typed wins over their territory's default city.
  const effectiveCity = safeZip ? undefined : safeCity || (myCities.length > 0 ? myCities[0] : undefined);
  const [events, checks, targetDays, topTargets, targetCities] = await Promise.all([
    listStormEvents(90),
    listRoofChecks(40),
    listTargetDays(),
    listStormTargets(
      {
        date: safeTargetDate,
        county: safeCounty,
        city: effectiveCity,
        days: safeDays,
        bigHail,
        zip: safeZip,
      },
      safeZip ? 500 : 300,
    ),
    listTargetCities(),
  ]);
  const topTargetsWithKnocks = await withLastKnock(topTargets);
  const days = clusterByDay(events);
  const bigDays = days.filter((d) => d.maxHail >= 1 || d.maxGust >= 60 || d.windDmg >= 3);

  return (
    <div className={wrap}>
      <div className="mx-auto max-w-6xl">
        {safeRep && (
          <div className="mb-4 rounded-lg border border-[#0c7a40] bg-[#f0fbf4] px-4 py-3">
            <span className="font-bold">{safeRep}</span>
            {myCities.length > 0 ? (
              <>
                {" "}· your territory: <strong>{myCities.join(", ")}</strong>
                {!safeCity && myCities.length > 1 && (
                  <span className="text-gray-600">
                    {" "}(showing {myCities[0]}; switch city below)
                  </span>
                )}
              </>
            ) : (
              <span className="text-gray-600">
                {" "}· no territory assigned yet, so you are seeing the whole list. Ask the
                office to assign your cities.
              </span>
            )}
            <span className="ml-2 text-gray-500">Doors you mark carry your name.</span>
          </div>
        )}
        <div className="flex items-end justify-between border-b border-gray-200 pb-4">
          <h1 className="font-display text-2xl font-extrabold">
            Storm Engine{" "}
            <span className="text-base font-semibold text-gray-500">
              100mi radius · last 90 days
            </span>
          </h1>
          {/* Leads is an office page; setters were offered a link that refused them. */}
          {user?.role === "admin" ? (
            <a href="/admin/leads" className="text-sm text-[#0c7a40] hover:underline">
              Leads →
            </a>
          ) : null}
        </div>

        {/* Summary chips */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { n: days.length, label: "storm days" },
            { n: bigDays.length, label: "major days (1″+ hail / 60+ gust)" },
            { n: events.filter((e) => e.type === "hail").length, label: "hail reports" },
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
          checks={checks.map((c) => ({
            address: c.address || c.matched || "",
            lat: c.lat ?? null,
            lon: c.lon ?? null,
            largest_in: c.largest_in ?? null,
            qualifies: c.qualifies ?? null,
          }))}
        />

        {/* Storm days, collapsed by default so targets stay one thumb-scroll away */}
        <details className="mt-10 rounded-lg border border-gray-200 p-4">
          <summary className="cursor-pointer font-display text-lg font-extrabold">
            Storm days{" "}
            <span className="text-sm font-semibold text-gray-500">
              ({days.length} in 90d, tap to expand)
            </span>
          </summary>
        {days.length === 0 ? (
          <p className="mt-2 text-gray-600">
            No storm reports ingested yet, the hourly cron fills this, or run a
            backfill: <code className="rounded bg-gray-100 px-1">POST /api/cron/storm-watch?days=365</code>
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Hail</th>
                  <th className="py-2 pr-4">Max hail</th>
                  <th className="hidden py-2 pr-4 sm:table-cell">Severe gusts</th>
                  <th className="hidden py-2 pr-4 sm:table-cell">Max gust</th>
                  <th className="hidden py-2 pr-4 sm:table-cell">Wind damage</th>
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
                      <td className="py-2.5 pr-4">{d.hail || ", "}</td>
                      <td className="py-2.5 pr-4 font-semibold">
                        {d.maxHail ? `${d.maxHail}″` : ", "}
                      </td>
                      <td className="hidden py-2.5 pr-4 sm:table-cell">{d.gusts || ", "}</td>
                      <td className="hidden py-2.5 pr-4 sm:table-cell">
                        {d.maxGust ? `${d.maxGust} mph` : ", "}
                      </td>
                      <td className="hidden py-2.5 pr-4 sm:table-cell">{d.windDmg || ", "}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{d.cities.join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </details>

        {/* Homeowner targets */}
        <h2 className="mt-10 font-display text-lg font-extrabold">
          Homeowner targets{" "}
          <span className="text-sm font-semibold text-gray-500">
            named owners at addresses inside the hail footprint · Dallas · Tarrant · Collin · Denton · Kaufman
          </span>
        </h2>
        {targetDays.length === 0 ? (
          <p className="mt-2 text-gray-600">
            None generated yet, auto-runs on fresh hail days, or backfill one:{" "}
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
                days: safeDays ? String(safeDays) : undefined,
                big: bigHail ? undefined : "0",
                zip: safeZip,
                ...over,
              };
              for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
              return `/admin/storms/office?${p}#targets`;
            };
            const chip = (active: boolean) =>
              `rounded-full border px-3 py-1.5 text-sm ${
                active ? "border-[#0b0e13] bg-[#0b0e13] text-white" : "border-gray-200"
              }`;
            const cities = targetCities.filter((c) => !safeCounty || c.county === safeCounty);
            return (
              <>
                {/* Which doors: proven big hail (default) or everything, and a ZIP */}
                <div id="targets" className="mt-3 flex flex-wrap items-center gap-2">
                  <a href={qs({ big: undefined })} className={`${chip(bigHail)} py-2 font-semibold`}>
                    {BIG_HAIL_IN} in+ hail at the house
                  </a>
                  <a href={qs({ big: "0" })} className={`${chip(!bigHail)} py-2`}>
                    All hail
                  </a>
                  <form method="get" action="/admin/storms/office#targets" className="flex items-center gap-1.5">
                    {key && <input type="hidden" name="key" value={key} />}
                    {!bigHail && <input type="hidden" name="big" value="0" />}
                    {safeDays && <input type="hidden" name="days" value={String(safeDays)} />}
                    <input
                      name="zip"
                      inputMode="numeric"
                      pattern="[0-9]{5}"
                      maxLength={5}
                      placeholder="ZIP"
                      defaultValue={safeZip || ""}
                      aria-label="ZIP code"
                      className="w-24 rounded-md border border-gray-300 px-2.5 py-2 text-sm"
                    />
                    <button type="submit" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold">
                      Go
                    </button>
                    {safeZip && (
                      <a href={qs({ zip: undefined })} className="text-sm text-gray-500 underline">
                        clear
                      </a>
                    )}
                  </form>
                </div>
                {safeZip && (
                  <p className="mt-2 text-sm text-gray-600">
                    ZIP {safeZip}: {topTargets.length} door{topTargets.length === 1 ? "" : "s"}, street by street.
                  </p>
                )}
                {topTargets.length === 0 && (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
                    <p className="font-bold">
                      No {bigHail ? `${BIG_HAIL_IN} in+ hail ` : ""}doors{safeZip ? ` in ${safeZip}` : effectiveCity ? ` in ${effectiveCity}` : ""} for these filters.
                    </p>
                    {bigHail && (
                      <a href={qs({ big: "0" })} className="mt-1 inline-block font-semibold text-[#0c7a40] underline">
                        Show all hail instead
                      </a>
                    )}
                  </div>
                )}
                {/* Recency quick filter */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { d: "10", label: "Hit last 10 days" },
                    { d: "30", label: "Last 30 days" },
                    { d: "90", label: "Last 90 days" },
                    { d: undefined, label: "All time" },
                  ].map((o) => (
                    <a
                      key={o.label}
                      href={qs({ days: o.d, targets: undefined })}
                      className={`${chip(
                        o.d ? safeDays === Number(o.d) && !safeTargetDate : !safeDays && !safeTargetDate,
                      )} py-2`}
                    >
                      {o.label}
                    </a>
                  ))}
                </div>
                {/* Specific storm-day chips */}
                <div className="mt-2 flex flex-wrap gap-2">
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
                    </a>
                  ))}
                </div>
                {/* County + city filters, counties appear once they have targets */}
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
                  <form method="get" action="/admin/storms/office" className="flex items-center gap-1.5">
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
                  {/*
                    The full homeowner export is office only, and the endpoint
                    already refuses anyone else. The button was still shown to
                    setters, who tapped it and got nothing.
                  */}
                  {user?.role === "admin" ? (
                    <a
                      href={`/api/admin/storm-targets?${
                        safeTargetDate ? `&date=${safeTargetDate}` : ""
                      }${safeDays && !safeTargetDate ? `&days=${safeDays}` : ""}${safeCounty ? `&county=${safeCounty}` : ""}${
                        safeCity ? `&city=${encodeURIComponent(safeCity)}` : ""
                      }&format=csv`}
                      className="rounded-full bg-[#0c7a40] px-3 py-1.5 text-sm font-semibold text-white"
                    >
                      ⬇ CSV for dialer / skip trace
                    </a>
                  ) : null}
                </div>
            {/* Mobile: knock cards w/ GPS near-me sorting (client component) */}
            <TargetCards
              targets={topTargetsWithKnocks.map((t) => ({
                id: t.id,
                owner_name: t.owner_name,
                address: t.address,
                city: t.city,
                zip: t.zip,
                hail_size_in: t.hail_size_in,
                absentee: t.absentee,
                year_built: t.year_built,
                value: t.value,
                score: t.score,
                lat: t.lat ?? null,
                lon: t.lon ?? null,
                phone: t.phone ?? null,
                phone_dnc: t.phone_dnc ?? null,
                status: t.status,
                county: t.county ?? null,
                knock: t.knock,
                radar_in: t.radar_in ?? null,
                radar_date: t.radar_date ?? null,
                storm_date: t.storm_date,
              }))}
            />
            {/* Desktop: full table */}
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-4">Score</th>
                    <th className="py-2 pr-4">Owner</th>
                    <th className="py-2 pr-4">Address</th>
                    <th className="py-2 pr-4">City</th>
                    <th className="py-2 pr-4">Zip</th>
                    <th className="py-2 pr-4">Radar hail</th>
                    <th className="py-2 pr-4">Storm</th>
                    <th className="py-2 pr-4">Occupancy</th>
                    <th className="py-2 pr-4">Built</th>
                    <th className="py-2 pr-4">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {topTargets.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-bold">{t.score}</td>
                      <td className="py-2 pr-4 font-semibold">{t.owner_name}</td>
                      <td className="whitespace-nowrap py-2 pr-4">
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(
                            `${t.address}, ${t.city || ""} TX ${t.zip || ""}`,
                          )}`}
                          target="_blank"
                          rel="noopener"
                          className="text-[#0c7a40] hover:underline"
                        >
                          {t.address}
                        </a>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4">{t.city || ", "}</td>
                      <td className="py-2 pr-4">{t.zip}</td>
                      <td className="py-2 pr-4 font-semibold">{t.radar_in ? `${Number(t.radar_in).toFixed(1)}″` : ", "}</td>
                      <td className="whitespace-nowrap py-2 pr-4">{fmtDate(t.storm_date)}</td>
                      <td className="py-2 pr-4 text-gray-600">
                        {t.absentee ? "Absentee/investor" : "Owner-occupied"}
                      </td>
                      <td className="py-2 pr-4">{t.year_built ?? ", "}</td>
                      <td className="py-2 pr-4">
                        {t.value ? `$${Math.round(t.value / 1000)}k` : ", "}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-gray-500">
                {bigHail ? `${BIG_HAIL_IN} in+ radar hail at the house, biggest first` : "Top by score"}
                {safeZip ? ` · ZIP ${safeZip}, street by street` : ""}
                {safeTargetDate ? ` for ${safeTargetDate}` : " across all storm days"}
                {safeCounty ? ` · ${safeCounty === "dallas" ? "Dallas" : "Tarrant"} County` : ""}
                {safeCity ? ` · ${safeCity}` : ""}. Full list in the CSV. Phones come from batch
                skip trace (upload the CSV to BatchData or similar, then DNC-scrub before dialing).
              </p>
            </div>
          </>
            );
          })()
        )}

        {/* Knock gold */}
        <h2 className="mt-10 font-display text-lg font-extrabold">
          Self-checked addresses{" "}
          <span className="text-sm font-semibold text-gray-500">
            ran the claim check, knock/dial first
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
                  <th className="hidden py-2 pr-4 sm:table-cell">Hail events</th>
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
                    <td className="py-2.5 pr-4 font-semibold">{c.address || c.matched || ", "}</td>
                    <td className="hidden py-2.5 pr-4 sm:table-cell">{c.hail_count ?? ", "}</td>
                    <td className="py-2.5 pr-4">{c.largest_in ? `${c.largest_in}″` : ", "}</td>
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
          Owner names come from county CAD rolls, numbers are DNC scrubbed, and
          scored targets land in the jobs pipeline. Cold outreach is knock and
          manual dial only: no cold texts, no AI cold calls (TCPA).
        </p>
      </div>
    </div>
  );
}
