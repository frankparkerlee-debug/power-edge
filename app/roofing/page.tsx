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
import { getService } from "@/lib/services";
import { getServiceContent } from "@/lib/serviceContent";
import { site } from "@/lib/site";

const service = getService("roofing")!;
const content = getServiceContent("roofing")!;

export const metadata: Metadata = {
  title: "Roofing Contractor in DFW — Repair, Replace & Storm Claims",
  description:
    "Residential and commercial roofing across Dallas–Fort Worth. Free inspections, fast replacements, and hail/insurance claims handled by the book. Backed by a licensed electrical contractor.",
};

export default function RoofingPage() {
  return (
    <>
      <PageHero
        kicker="Roofing · Free inspection"
        title="Roofing done right — and a company you can verify."
        intro="In Texas, anyone can call themselves a roofer. We're a licensed electrical contractor that also runs four roofing crews under a 20-year project manager. Free inspections, honest assessments, and replacements done fast."
        badge="Get a free roof inspection"
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

      {/* Storm / insurance education — the trust + lead-gen play */}
      <section className="bg-ink py-20 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionHeading
              dark
              kicker="Storm & insurance"
              title="Hail claims, handled honestly."
              intro="A storm claim is where most homeowners get burned by fly-by-night roofers. Here's how we do it differently — and legally."
            />
          </div>
          <div className="space-y-5">
            {[
              {
                h: "We never waive your deductible",
                p: "It's a crime in Texas for a contractor to offer to waive, rebate, or absorb your insurance deductible. Anyone who offers is breaking the law — and putting you at risk.",
              },
              {
                h: "We don't pretend to be your adjuster",
                p: "Texas law prohibits the company doing your repair from also acting as your public insurance adjuster. We document damage and work with your adjuster — we don't cross that line.",
              },
              {
                h: "We document everything",
                p: "Photos, measurements, and a written assessment of storm and hail damage so your claim is built on evidence, not guesswork.",
              },
              {
                h: "We know the two-check process",
                p: "Replacement-cost claims pay in two parts — an initial check, then the balance once work begins. We'll walk you through exactly what to expect.",
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
            { big: `${site.capacity.crews}`, small: "roofing crews" },
            {
              big: `~${site.capacity.roofsPerMonth}`,
              small: "roofs / month capacity",
            },
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
        heading="Free roof inspection — no pressure."
        sub="We'll get on the roof, take photos, and give you a straight answer. If it doesn't need replacing, we'll tell you."
      />
    </>
  );
}
