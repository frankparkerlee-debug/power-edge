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

const service = getService("commercial")!;
const content = getServiceContent("commercial")!;

export const metadata: Metadata = {
  title: "Commercial Roofing in DFW",
  description:
    "One licensed, insured partner for commercial roofing across Dallas–Fort Worth. Property managers and business owners get scheduled, documented, warrantied work with a single point of contact.",
};

export default function CommercialPage() {
  return (
    <>
      <PageHero
        kicker="Commercial · Property managers"
        title="One licensed, insured partner for your roof."
        intro="Property managers and business owners shouldn't have to chase down a contractor. PowerEdge covers commercial roofing under one accountable team — scheduled around your operation and documented for your records."
        badge="Request a commercial quote"
        withForm
      />

      <ServiceTrustBar />

      <section className="bg-paper py-20 sm:py-28">
        <Container>
          <SectionHeading
            kicker="Built for business"
            title="Commercial roofing, on your schedule."
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
                p: "One number, one crew, no chasing subcontractors.",
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

      <Process
        title="One partner, both trades, on your schedule."
        steps={content.process}
      />

      <Reviews />

      <FaqSection
        faqs={content.faqs}
        title="Commercial questions, answered straight."
      />

      <RelatedServices currentSlug="commercial" />

      <CtaBand
        heading="Let's scope your property."
        sub="Tell us about your building and we'll put together a plan for the roof."
      />
    </>
  );
}
