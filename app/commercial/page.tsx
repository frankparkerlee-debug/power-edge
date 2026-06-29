import type { Metadata } from "next";
import { Container, SectionHeading } from "@/components/ui";
import { PageHero, CtaBand, FeatureList } from "@/components/blocks";
import { getService } from "@/lib/services";

const service = getService("commercial")!;

export const metadata: Metadata = {
  title: "Commercial Roofing & Electrical in DFW",
  description:
    "One licensed partner for commercial roofing and electrical across Dallas–Fort Worth. Property managers and business owners get scheduled, documented, warrantied work with a single point of contact.",
};

export default function CommercialPage() {
  return (
    <>
      <PageHero
        kicker="Commercial · Property managers"
        title="One licensed partner for your roof and your electrical."
        intro="Property managers and business owners shouldn't juggle two contractors. PowerEdge covers commercial roofing and electrical under one accountable team — scheduled around your operation and documented for your records."
        badge="Request a commercial quote"
      />

      <section className="bg-paper py-20 sm:py-28">
        <Container>
          <SectionHeading
            kicker="Built for business"
            title="Roofing and electrical, on your schedule."
            intro={service.blurb}
          />
          <div className="mt-10">
            <FeatureList items={service.bullets} />
          </div>
        </Container>
      </section>

      <section className="bg-ink py-20 sm:py-28">
        <Container>
          <SectionHeading
            dark
            kicker="Why property managers choose us"
            title="Less coordination. One invoice. Real accountability."
            align="center"
          />
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 sm:grid-cols-3">
            {[
              {
                h: "Single point of contact",
                p: "One number for roofing and electrical — no chasing two trades.",
              },
              {
                h: "Documented & warrantied",
                p: "Photo documentation, code-compliant work, and a workmanship guarantee.",
              },
              {
                h: "24/7 emergency response",
                p: "When something fails after hours, a licensed crew responds.",
              },
            ].map((b) => (
              <div
                key={b.h}
                className="rounded-card border border-line bg-ink-2 p-7"
              >
                <h3 className="font-display text-lg font-bold text-fg-inv">
                  {b.h}
                </h3>
                <p className="mt-2 text-sm text-fg-inv-dim">{b.p}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand
        heading="Let's scope your property."
        sub="Tell us about your building and we'll put together a plan for the roof, the electrical, or both."
      />
    </>
  );
}
