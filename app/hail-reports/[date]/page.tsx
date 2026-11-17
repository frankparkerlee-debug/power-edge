import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Kicker } from "@/components/ui";
import { CtaBand } from "@/components/blocks";
import { FaqSection } from "@/components/service-blocks";
import { site } from "@/lib/site";
import { cities } from "@/lib/cities";
import { haversineMi } from "@/lib/storm";
import {
  NEAR_MI,
  PAGE_MIN_IN,
  centralDate,
  niceDay,
  serviceAreaHail,
  stoneSize,
  stormDays,
} from "@/lib/hailHistory";

/**
 * One storm day: every hail report the National Weather Service logged in our
 * counties, the cities it was reported near, and what a homeowner can do next.
 * Only days with hail 1 inch or larger get a page. This is what people search
 * the morning after ("hail Keller April 28").
 */
export const revalidate = 21600;
export const dynamicParams = true;

const SINCE = "2025-08-01T00:00:00Z";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function load(date: string) {
  if (!DATE.test(date)) return null;
  // The Central day spans two UTC dates, so fetch a little either side.
  const from = new Date(`${date}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const all = await serviceAreaHail(from.toISOString());
  const reports = all.filter((r) => centralDate(r.valid_at) === date);
  const day = stormDays(reports)[0];
  if (!day || day.maxIn < PAGE_MIN_IN) return null;
  return { day, reports: [...reports].sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0)) };
}

export async function generateStaticParams() {
  const days = stormDays(await serviceAreaHail(SINCE));
  return days.filter((d) => d.maxIn >= PAGE_MIN_IN).map((d) => ({ date: d.date }));
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  const data = await load(date);
  if (!data) return {};
  const { day } = data;
  const where = day.counties.length === 1 ? `${day.counties[0]} County` : "North Texas";
  return {
    title: `Hail in ${where} on ${niceDay(date)}: Where It Was Reported`,
    description: `${day.reports} National Weather Service hail report${day.reports === 1 ? "" : "s"} on ${niceDay(date)} in ${day.counties.join(", ")} ${day.counties.length === 1 ? "County" : "counties"}. Largest: ${stoneSize(day.maxIn)}${day.biggestTown ? ` near ${day.biggestTown}` : ""}.`,
    alternates: { canonical: `${site.url}/hail-reports/${date}` },
  };
}

export default async function StormDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const data = await load(date);
  if (!data) notFound();
  const { day, reports } = data;

  const nearCities = cities
    .map((c) => {
      const near = reports.filter((r) => haversineMi(c.lat, c.lon, r.lat, r.lon) <= NEAR_MI);
      return { c, n: near.length, max: Math.max(0, ...near.map((r) => r.magnitude ?? 0)) };
    })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.max - a.max);

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
  const title = (s: string | null) => (s ? s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()) : "");

  const faqs = [
    {
      q: `Where was hail reported on ${niceDay(date)}?`,
      a: `The National Weather Service logged ${day.reports} hail report${day.reports === 1 ? "" : "s"} in ${day.counties.join(", ")} ${day.counties.length === 1 ? "County" : "counties"}, near ${day.towns.slice(0, 5).join(", ")}. The largest was ${stoneSize(day.maxIn)}${day.biggestTown ? ` near ${day.biggestTown}` : ""}.`,
    },
    {
      q: "Does a hail report near me mean my roof is damaged?",
      a: "Not necessarily. A report marks where hail was seen, not every roof it fell on. Hail an inch or larger can bruise or crack asphalt shingles, and dented gutters, vents and A/C fins are common signs. Only an inspection tells you about your roof.",
    },
    {
      q: "How long do I have to report storm damage to my insurer?",
      a: "It depends on your policy. Many policies set a deadline counted from the date of the storm, so check yours and keep this date. We don't file or negotiate claims; if you decide to file, our inspection documents what's on your roof.",
    },
  ];

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `Hail reported on ${niceDay(date)} in North Texas`,
    datePublished: `${date}T23:00:00-05:00`,
    dateModified: new Date().toISOString(),
    author: { "@type": "Organization", name: site.legalName, url: site.url },
    publisher: { "@type": "Organization", name: site.legalName, url: site.url },
    isBasedOn: "https://www.weather.gov/fwd/",
    mainEntityOfPage: `${site.url}/hail-reports/${date}`,
  };

  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0 grid-texture opacity-60" />
        <Container className="relative py-14 sm:py-16">
          <Kicker className="mb-4">
            <Link href="/hail-reports" className="hover:underline">Hail reports</Link> · {niceDay(date)}
          </Kicker>
          <h1 className="max-w-3xl font-display text-3xl leading-[1.02] text-fg-inv sm:text-4xl md:text-5xl">
            Hail reported on {niceDay(date)}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-inv-dim">
            The National Weather Service logged {day.reports} hail report{day.reports === 1 ? "" : "s"} in{" "}
            {day.counties.join(", ")} {day.counties.length === 1 ? "County" : "counties"}. The largest was{" "}
            {stoneSize(day.maxIn)}
            {day.biggestTown ? ` near ${day.biggestTown}` : ""}.
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
          {nearCities.length ? (
            <>
              <h2 className="font-display text-2xl font-bold text-fg">Cities with a report within {NEAR_MI} miles</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {nearCities.map(({ c, max }) => (
                  <li key={c.slug}>
                    <Link
                      href={`/service-areas/${c.slug}`}
                      className="inline-flex rounded-full border border-paper-2 bg-white px-3 py-1.5 text-sm font-semibold text-fg hover:border-bolt-deep"
                    >
                      {c.name} · up to {max}″
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h2 className="mt-12 font-display text-2xl font-bold text-fg">Every report that day</h2>
          <div className="mt-5 overflow-x-auto rounded-card border border-paper-2 bg-white">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-paper text-xs uppercase tracking-wider text-fg-dim">
                <tr>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Near</th>
                  <th className="px-4 py-3">County</th>
                  <th className="px-4 py-3 text-right">Time (Central)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-2">
                {reports.map((r, i) => (
                  <tr key={`${r.valid_at}-${r.lat}-${r.lon}-${i}`}>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{r.magnitude ? stoneSize(r.magnitude) : "Size not given"}</td>
                    <td className="px-4 py-3 text-fg-dim">{title(r.city)}</td>
                    <td className="px-4 py-3 text-fg-dim">{r.county}</td>
                    <td className="px-4 py-3 text-right text-fg-dim whitespace-nowrap">{time(r.valid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-12 font-display text-2xl font-bold text-fg">If you live near one of these reports</h2>
          <ol className="mt-4 space-y-3 text-fg-dim">
            <li>
              <strong className="text-fg">1. Check your address.</strong> Our{" "}
              <Link href="/roof-claim-check" className="font-semibold text-bolt-deep underline">claim check</Link>{" "}
              shows every hail report on record near your home, free.
            </li>
            <li>
              <strong className="text-fg">2. Look from the ground.</strong> Dented gutters, downspouts, roof vents and A/C fins,
              and shingle granules collecting at the downspouts, are common signs. Stay off the roof.
            </li>
            <li>
              <strong className="text-fg">3. Get it documented.</strong> A{" "}
              <Link href="/schedule" className="font-semibold text-bolt-deep underline">free inspection</Link> gives you photos
              and a written verdict, including when the answer is that your roof is fine. You decide what’s next.
            </li>
          </ol>

          <p className="mt-10 text-xs text-fg-dim">
            Source: National Weather Service local storm reports, via the Iowa Environmental Mesonet. A report marks where hail
            was seen and how big, not every street it fell on. <Link href="/hail-reports" className="underline">All DFW hail reports</Link>.
          </p>
        </Container>
      </section>

      <FaqSection faqs={faqs} title="Quick answers" />
      <CtaBand
        heading="Want someone to look at your roof?"
        sub="A free, documented inspection with an honest verdict in writing."
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }}
      />
    </>
  );
}
