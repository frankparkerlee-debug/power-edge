import type { Metadata } from "next";
import Link from "next/link";
import { Container, Kicker } from "@/components/ui";
import { CtaBand } from "@/components/blocks";
import { site } from "@/lib/site";
import {
  SERVICE_COUNTIES,
  NEAR_MI,
  PAGE_MIN_IN,
  allCitiesHail,
  niceDay,
  serviceAreaHail,
  stoneSize,
  stormDays,
  twelveMonthsAgo,
} from "@/lib/hailHistory";

/**
 * DFW hail reports: every storm day the National Weather Service logged hail
 * in the 11 counties PowerEdge serves, and when hail was last reported near
 * each city we have a page for. Original, dated, updated on its own: the page
 * an answer engine can cite for "did it hail in Plano this year?".
 */
export const revalidate = 21600;

const SINCE = "2025-08-01T00:00:00Z"; // when PowerEdge started recording reports

export const metadata: Metadata = {
  title: "DFW Hail Reports: Every 2026 Hail Storm by City and County",
  description:
    "Every day the National Weather Service logged hail in Dallas–Fort Worth and North Texas, with the largest stone reported and the towns it was reported in. Updated automatically.",
  alternates: { canonical: `${site.url}/hail-reports` },
};

export default async function HailReportsPage() {
  const reports = await serviceAreaHail(SINCE);
  const days = stormDays(reports);
  const year = new Date().getFullYear();
  const thisYear = days.filter((d) => d.date.startsWith(String(year)));
  const ytdReports = thisYear.reduce((n, d) => n + d.reports, 0);
  const biggest = thisYear.reduce<(typeof days)[number] | null>((m, d) => (!m || d.maxIn > m.maxIn ? d : m), null);
  const latest = days[0] ?? null;
  const last12 = reports.filter((r) => r.valid_at >= twelveMonthsAgo());
  const byCity = allCitiesHail(last12).sort((a, b) => ((a.last?.date ?? "") < (b.last?.date ?? "") ? 1 : -1));
  const updated = new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" });

  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Dallas–Fort Worth hail reports",
    description: `National Weather Service hail reports for ${SERVICE_COUNTIES.join(", ")} counties, Texas, grouped by storm day, with the largest stone reported and the towns reported in.`,
    url: `${site.url}/hail-reports`,
    creator: { "@type": "Organization", name: site.legalName, url: site.url },
    isBasedOn: "https://www.weather.gov/fwd/",
    temporalCoverage: `${SINCE.slice(0, 10)}/..`,
    spatialCoverage: { "@type": "Place", name: "Dallas–Fort Worth and North Texas" },
    dateModified: new Date().toISOString(),
    variableMeasured: "Hail diameter reported (inches)",
  };

  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0 grid-texture opacity-60" />
        <Container className="relative py-14 sm:py-16">
          <Kicker className="mb-4">Hail reports · Updated {updated}</Kicker>
          <h1 className="max-w-3xl font-display text-3xl leading-[1.02] text-fg-inv sm:text-4xl md:text-5xl">
            Hail reported in Dallas–Fort Worth
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-inv-dim">
            {thisYear.length ? (
              <>
                In {year}, the National Weather Service has logged {ytdReports} hail reports on {thisYear.length}{" "}
                days across the {SERVICE_COUNTIES.length} North Texas counties we serve.
                {biggest ? ` The largest was ${stoneSize(biggest.maxIn)}${biggest.biggestTown ? ` near ${biggest.biggestTown}` : ""} on ${niceDay(biggest.date, false)}.` : ""}
                {latest ? ` The most recent was ${niceDay(latest.date)}${latest.biggestTown ? ` near ${latest.biggestTown}` : ""}.` : ""}
              </>
            ) : (
              "No hail has been reported in our counties this year yet."
            )}
          </p>
          <div className="mt-7">
            <Link href="/roof-claim-check" className="inline-flex rounded-full bg-bolt px-6 py-3 font-display font-bold text-ink">
              Check your address →
            </Link>
          </div>
        </Container>
      </section>

      <section className="bg-paper py-14 sm:py-16">
        <Container className="max-w-4xl">
          <h2 className="font-display text-2xl font-bold text-fg">When was hail last reported near you?</h2>
          <p className="mt-2 text-fg-dim">
            The last 12 months, counting reports within {NEAR_MI} miles of each city’s center.
          </p>
          <div className="mt-5 overflow-x-auto rounded-card border border-paper-2 bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-paper text-xs uppercase tracking-wider text-fg-dim">
                <tr>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Last reported</th>
                  <th className="px-4 py-3">Largest in 12 months</th>
                  <th className="px-4 py-3">Hail days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-2">
                {byCity.map((c) => (
                  <tr key={c.city.slug}>
                    <td className="px-4 py-3 font-semibold">
                      <Link href={`/service-areas/${c.city.slug}`} className="text-bolt-deep hover:underline">
                        {c.city.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-fg-dim">{c.last ? `${niceDay(c.last.date)}, ${c.last.maxIn}″` : "None reported"}</td>
                    <td className="px-4 py-3 text-fg-dim">{c.biggest ? `${stoneSize(c.biggest.maxIn)}, ${niceDay(c.biggest.date)}` : "None"}</td>
                    <td className="px-4 py-3 text-fg-dim">{c.days.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-14 font-display text-2xl font-bold text-fg">Every storm day</h2>
          <p className="mt-2 text-fg-dim">
            Newest first. Days with hail an inch or larger have their own page with every report.
          </p>
          <div className="mt-5 overflow-x-auto rounded-card border border-paper-2 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-paper text-xs uppercase tracking-wider text-fg-dim">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Largest reported</th>
                  <th className="px-4 py-3">Reported near</th>
                  <th className="px-4 py-3">Counties</th>
                  <th className="px-4 py-3 text-right">Reports</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-2">
                {days.map((d) => (
                  <tr key={d.date}>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {d.maxIn >= PAGE_MIN_IN ? (
                        <Link href={`/hail-reports/${d.date}`} className="text-bolt-deep hover:underline">
                          {niceDay(d.date)}
                        </Link>
                      ) : (
                        niceDay(d.date)
                      )}
                    </td>
                    <td className="px-4 py-3 text-fg-dim whitespace-nowrap">{stoneSize(d.maxIn)}</td>
                    <td className="px-4 py-3 text-fg-dim">{d.towns.slice(0, 4).join(", ")}</td>
                    <td className="px-4 py-3 text-fg-dim">{d.counties.join(", ")}</td>
                    <td className="px-4 py-3 text-right text-fg-dim">{d.reports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-12 rounded-card border border-paper-2 bg-white p-5 text-sm leading-relaxed text-fg-dim">
            <h2 className="font-display text-base font-bold text-fg">Where these numbers come from</h2>
            <p className="mt-2">
              Every row is a hail report the National Weather Service logged for {SERVICE_COUNTIES.join(", ")}{" "}
              counties: storm spotters, emergency managers, and the public, collected through the Iowa
              Environmental Mesonet and refreshed every hour. Records here start in August 2025.
            </p>
            <p className="mt-2">
              A report marks where hail was seen and how big it was, not every street it fell on. Hail can
              damage a roof a few miles from the nearest report, and a reported storm doesn’t mean every roof
              nearby was damaged. Only an inspection tells you about your roof. Many insurance policies set a
              deadline for reporting storm damage, counted from the date of the storm. Check yours.
            </p>
          </div>
        </Container>
      </section>

      <CtaBand
        heading="Was hail reported near your home?"
        sub="Enter your address and see every storm on record for it, free. If you want someone to look, a documented inspection is free too."
      />

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }}
      />
    </>
  );
}
