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

const service = getService("solar")!;
const content = getServiceContent("solar")!;

export const metadata: Metadata = {
  title: "Solar Panel Repair & Replacement in DFW",
  description:
    "Solar panel repair and replacement across Dallas–Fort Worth, performed under a licensed Master Electrician as Texas law requires. We service and replace existing systems — we do not sell new installs.",
};

export default function SolarPage() {
  return (
    <>
      <PageHero
        kicker="Solar · Repair & replacement"
        title="Solar repair and replacement, done under a real electrical license."
        intro="Solar work is electrical work — and Texas law requires it to run under a licensed Master Electrician. We repair, replace, and re-energize existing systems. We don't sell new installs, so there's no sales pitch — just the fix."
        badge="Get a solar service quote"
        withForm
      />

      <ServiceTrustBar />

      <section className="bg-paper py-20 sm:py-28">
        <Container>
          <SectionHeading
            kicker="What we handle"
            title="For systems you already own."
            intro={service.blurb}
          />
          <div className="mt-10">
            <FeatureList items={service.bullets} />
          </div>
        </Container>
      </section>

      {/* Why the license matters for solar */}
      <section className="bg-ink py-20 sm:py-28">
        <Container className="grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <SectionHeading
              dark
              kicker="Why it matters"
              title="Most roofers can't legally touch your solar."
              intro="Texas tightened solar rules in 2025 — the licensed electrical contractor's name and number must appear on solar work. A roofing-only company isn't licensed to repair or reconnect your panels. We are."
            />
          </div>
          <div className="rounded-card border border-line bg-ink-2 p-8 text-center">
            <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
              Performed under
            </div>
            <div className="mt-2 font-display text-3xl font-extrabold text-bolt">
              TECL #{site.teclLicense}
            </div>
            <div className="mt-2 text-sm text-fg-inv-dim">
              Master Electrician John Lott · 40 years
            </div>
          </div>
        </Container>
      </section>

      <Process
        title="A licensed fix for the system you own."
        steps={content.process}
      />

      <Reviews />

      <FaqSection faqs={content.faqs} title="Solar questions, answered straight." />

      <RelatedServices currentSlug="solar" />

      <CtaBand
        heading="Panels down or damaged?"
        sub="Tell us what your system is doing and we'll get a licensed electrician out to assess it."
      />
    </>
  );
}
