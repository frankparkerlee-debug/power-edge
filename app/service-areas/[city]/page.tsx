import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container, SectionHeading } from "@/components/ui";
import { CtaBand, FeatureList } from "@/components/blocks";
import { FaqSection } from "@/components/service-blocks";
import { cities, getCity, type City } from "@/lib/cities";
import { services } from "@/lib/services";
import { site } from "@/lib/site";

export function generateStaticParams() {
  return cities.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const c = getCity(city);
  if (!c) return {};
  return {
    title: `Roofing Company in ${c.name}, TX — Storm & Hail Roof Repair`,
    description: `Storm & hail roof repair, replacement, and insurance-claim roofing in ${c.name}. Free inspections, deductible financing from $250 down, licensed & insured, rated ${site.googleRating}★.`,
  };
}

// City-templated FAQs — real answers (FAQPage schema via FaqSection) that
// match what homeowners and AI search actually ask about roofing in a city.
function cityFaqs(c: City) {
  return [
    {
      q: `How much does a roof replacement cost in ${c.name}?`,
      a: `Most ${c.name} asphalt roofs start around $400–$450 per square (100 sq ft) installed, with premium materials and add-ons running higher. On a covered storm claim you typically pay only your deductible — and you can finance that from $250 down. A free inspection gets you exact numbers in writing.`,
    },
    {
      q: `Hail hit ${c.name} — do I have an insurance claim?`,
      a: `Maybe — reported hail near your address plus actual roof damage is what makes a claim. We check your address against National Weather Service storm records free at our roof claim check, then a free inspection documents whether the damage is worth filing. If your roof is fine, we tell you that in writing.`,
    },
    {
      q: `How fast can you get to my roof in ${c.name}?`,
      a: `Fast. We run four crews across Dallas–Fort Worth with capacity for roughly ${site.capacity.roofsPerMonth} roofs a month, so inspections in ${c.name} usually happen within days — sooner right after a storm if you book early.`,
    },
    {
      q: `Do you handle the insurance claim for me?`,
      a: `We document the damage — photos, measurements, a written scope — and coordinate with your adjuster by the book. Texas law doesn't allow a roofer to negotiate your claim or waive your deductible, and we never do either. Doing it right protects you.`,
    },
    {
      q: `My ${c.name} home has solar panels. Can you still replace the roof?`,
      a: `Yes — that's our specialty. Panels have to come off and go back on for a replacement, which is electrical work most roofers can't legally perform. We detach and reset them in-house, and it's usually a covered line item on your claim.`,
    },
  ];
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const c = getCity(city);
  if (!c) notFound();

  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0 grid-texture opacity-60" />
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-bolt/15 blur-[120px]" />
        <Container className="relative py-16 sm:py-20">
          <p className="kicker text-bolt mb-5">
            <span className="mr-2 inline-block h-2 w-2 translate-y-[-1px] bg-bolt" />
            {c.county} · Licensed & insured
          </p>
          <h1 className="max-w-3xl font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl md:text-6xl">
            {c.name}&apos;s storm-first roofing company.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-fg-inv-dim">
            {c.blurb}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/roof-claim-check"
              className="inline-flex items-center justify-center rounded-md bg-bolt px-6 py-3.5 font-display font-bold text-ink hover:bg-bolt-hi"
            >
              Check my roof for a claim →
            </Link>
            <Link
              href="/free-inspection"
              className="inline-flex items-center justify-center rounded-md border-2 border-bolt px-6 py-3.5 font-display font-bold text-bolt hover:bg-bolt/10"
            >
              Book a free inspection
            </Link>
            <a
              href={site.phoneHref}
              className="inline-flex items-center justify-center rounded-md border border-line px-6 py-3.5 font-display font-bold text-fg-inv hover:border-bolt hover:text-bolt"
            >
              Call {site.phone}
            </a>
          </div>
        </Container>
      </section>

      <section className="bg-paper py-20 sm:py-28">
        <Container>
          <SectionHeading
            kicker={`Serving ${c.name}`}
            title={`Roof repair, replacement & storm claims in ${c.name}.`}
            intro={`The same licensed crew and the same standard across ${c.county}: evidence-based inspections, claims documented by the book, and honest answers — even when the answer is "your roof is fine."`}
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {services.map((s) => (
              <Link
                key={s.slug}
                href={`/${s.slug}`}
                className="group rounded-card border border-paper-2 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="font-display text-xl font-bold text-fg">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-fg-dim">{s.blurb}</p>
                <span className="mt-4 inline-block font-display text-sm font-bold text-bolt-deep">
                  Learn more →
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-12">
            <FeatureList
              items={[
                `Free roof inspections across ${c.name} — verdict in writing`,
                "Deductible financing from $250 down, paid in full over time",
                `Storm & hail insurance claims documented by the book`,
                `Rated ${site.googleRating}★ by North Texas homeowners`,
              ]}
            />
          </div>

          <div className="mt-10">
            <p className="text-sm text-fg-dim">
              Other areas we serve:{" "}
              {cities
                .filter((x) => x.slug !== c.slug)
                .map((x, i, arr) => (
                  <span key={x.slug}>
                    <Link
                      href={`/service-areas/${x.slug}`}
                      className="text-fg underline-offset-2 hover:text-bolt-deep hover:underline"
                    >
                      {x.name}
                    </Link>
                    {i < arr.length - 1 ? ", " : "."}
                  </span>
                ))}
            </p>
          </div>
        </Container>
      </section>

      <FaqSection
        faqs={cityFaqs(c)}
        title={`${c.name} roofing questions, answered straight.`}
      />

      <CtaBand
        heading={`Storm damage in ${c.name}? Get eyes on it free.`}
        sub="Free inspection, documented for your claim, deductible financing from $250 down — and a straight answer either way."
      />
    </>
  );
}
