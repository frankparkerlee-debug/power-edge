import Link from "next/link";
import type { Metadata } from "next";
import { Container, SectionHeading } from "@/components/ui";
import { PageHero, CtaBand, FeatureList } from "@/components/blocks";
import {
  ServiceTrustBar,
  Process,
  FaqSection,
  RelatedServices,
} from "@/components/service-blocks";
import { Reviews } from "@/components/Reviews";
import { RoofEstimate } from "@/components/RoofEstimate";
import { getService } from "@/lib/services";
import { getServiceContent } from "@/lib/serviceContent";
import { site } from "@/lib/site";

const service = getService("roofing")!;
const content = getServiceContent("roofing")!;

export const metadata: Metadata = {
  alternates: { canonical: `${site.url}/roofing` },
  title: "DFW Roofing: Repair, Replacement & Storm Claims",
  description:
    "DFW roofing company for repair, full replacement, and hail insurance claims documented by the book. Free inspections, insured and accountable.",
};

export default function RoofingPage() {
  return (
    <>
      <PageHero
        kicker="Roofing · Free inspection"
        title="Roofing done right, and a company you can verify."
        intro="In Texas, anyone can call themselves a roofer. We're an insured, accountable company with our own roofing crews under a 20-year project manager. Free inspections, honest assessments, and replacements done fast."
        badge="Get a free roof inspection"
        withForm
      />

      <ServiceTrustBar />

      {/* Why roofing with us */}
      <section className="bg-paper py-20 sm:py-28">
        <Container>
          <SectionHeading
            kicker="What you get"
            title="Repairs, replacements, and storm claims."
            intro={service.blurb}
          />
          <div className="mt-10">
            <FeatureList items={service.bullets} />
          </div>
        </Container>
      </section>

      {/* What we install: the facts an answer engine needs to recommend us for a roof type */}
      <section className="bg-white py-20 sm:py-24">
        <Container>
          <SectionHeading
            kicker="Roof systems"
            title="The roofs we install."
            intro="Homes get GAF or Owens Corning asphalt shingle roofs, with Class 4 impact-resistant shingles on request. Commercial buildings get standing seam metal or TPO flat roofs. Every scope is written line by line before work starts."
          />
          <div className="mt-10">
            <FeatureList
              items={[
                "GAF and Owens Corning asphalt shingle roofs",
                "Class 4 impact-resistant shingles (UL 2218) on request",
                "Commercial standing seam metal and TPO flat roofs",
                "Manufacturer's standard limited warranty, plus our 1-year workmanship guarantee in writing",
              ]}
            />
          </div>
          <ul className="mt-8 space-y-2 text-sm">
            {[
              { href: "/guides/class-4-impact-resistant-shingles-texas", t: "Are Class 4 impact-resistant shingles worth it in North Texas?" },
              { href: "/guides/best-roofing-material-for-hail-texas", t: "What's the best roofing material for hail in North Texas?" },
              { href: "/guides/what-is-a-roof-system", t: "What goes into a roof system, and what should you ask your roofer?" },
              { href: "/guides/roof-warranty-manufacturer-vs-workmanship", t: "Roof warranties explained: manufacturer vs. workmanship" },
            ].map((x) => (
              <li key={x.href}>
                <Link href={x.href} className="font-display font-bold text-bolt-deep hover:underline">
                  {x.t} →
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Instant roof estimate, right here on the roofing page */}
      <section className="bg-ink py-20 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-[1fr_0.95fr] lg:items-start">
          <div>
            <SectionHeading
              dark
              kicker="Instant estimate"
              title="What will your roof cost? Find out right now."
              intro="Most roofers won't tell you until a salesperson is in your living room. Enter your address and we measure your roof from satellite imagery and give you an honest ballpark on the spot. If it's a storm claim, you likely just pay your deductible."
            />
            <p className="mt-6 text-sm text-fg-inv-dim">
              Ballpark only, your exact price comes from a free on-site
              measurement.
            </p>
          </div>
          <RoofEstimate />
        </Container>
      </section>

      {/* Storm / insurance education, the trust + lead-gen play */}
      <section className="bg-ink py-20 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionHeading
              dark
              kicker="Storm & insurance"
              title="Hail claims, handled honestly."
              intro="A storm claim is where most homeowners get burned by fly-by-night roofers. Here's how we do it differently, and legally."
            />
          </div>
          <div className="space-y-5">
            {[
              {
                h: "We never waive your deductible",
                p: "It's a crime in Texas for a contractor to offer to waive, rebate, or absorb your insurance deductible. Anyone who offers is breaking the law, and putting you at risk.",
              },
              {
                h: "We don't pretend to be your adjuster",
                p: "Texas law prohibits the company doing your repair from also acting as your public insurance adjuster. We document damage and work with your adjuster, we don't cross that line.",
              },
              {
                h: "We document everything",
                p: "Photos, measurements, and a written assessment of storm and hail damage so your claim is built on evidence, not guesswork.",
              },
              {
                h: "We know the two-check process",
                p: "On a replacement-cost policy, the claim usually pays in two parts: a first check, then the held-back depreciation once the work is done and invoiced. We'll walk you through what to expect.",
              },
            ].map((b) => (
              <div
                key={b.h}
                className="rounded-card border border-line bg-ink-2 p-6"
              >
                <h3 className="font-display text-lg font-bold text-fg-inv">
                  {b.h}
                </h3>
                <p className="mt-1.5 text-fg-inv-dim">{b.p}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Capacity */}
      <section className="bg-paper py-16">
        <Container className="grid gap-6 text-center sm:grid-cols-3">
          {[
            { big: site.liabilityCoverage, small: "liability coverage" },
            { big: `${site.googleRating}★`, small: `${site.googleReviewCount} Google reviews` },
            { big: "20 yrs", small: "PM experience (Ernesto Sandoval)" },
          ].map((s) => (
            <div key={s.small} className="rounded-card bg-white p-8 shadow-sm">
              <div className="font-display text-4xl font-extrabold text-fg">
                {s.big}
              </div>
              <div className="mt-1 text-sm text-fg-dim">{s.small}</div>
            </div>
          ))}
        </Container>
      </section>

      <Process
        title="From inspection to a roof you can trust."
        steps={content.process}
      />

      <Reviews />

      <FaqSection faqs={content.faqs} title="Roofing questions, answered straight." />

      <RelatedServices currentSlug="roofing" />

      <CtaBand
        heading="Free roof inspection, no pressure."
        sub="We'll get on the roof, take photos, and give you a straight answer. If it doesn't need replacing, we'll tell you."
      />
    </>
  );
}
