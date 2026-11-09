import type { Metadata } from "next";
import { site } from "@/lib/site";
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

const service = getService("exterior")!;
const content = getServiceContent("exterior")!;

export const metadata: Metadata = {
  alternates: { canonical: `${site.url}/exterior` },
  title: "Siding, Gutters & Fence Repair in DFW",
  description:
    "Hail hits more than the roof. Siding, fascia, gutters and fencing repaired across North Texas, documented on the same inspection so nothing is left off your claim.",
};

export default function ExteriorPage() {
  return (
    <>
      <PageHero
        kicker="Siding · Fascia · Gutters · Fencing"
        title="Hail doesn't stop at the roofline."
        intro="The storm that bruised your shingles also dented your gutters, cracked your siding and splintered your fence. We document all of it on the same free inspection, because a claim that only covers the roof pays for half the damage."
        badge="Book a free inspection"
        badgeHref="/schedule"
      />

      <ServiceTrustBar />

      <section className="bg-paper py-20 sm:py-28">
        <Container>
          <SectionHeading
            kicker="What we do"
            title="A deliberately short list."
            intro="Siding, fascia and soffit, gutters, and fencing. These are the trades that sit next to a storm-damaged roof, so our crews already work on them and our inspections already photograph them. We don't do kitchens, and we'd rather say so than learn on your house."
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
            kicker="Why it matters on a claim"
            title="The soft metals are the evidence."
            intro="Hail damage to a shingle can be argued about. A dented gutter, a cracked fascia wrap and a bruised A/C fin are harder to dispute and they date the storm. Reps photograph them on every inspection whether or not you ever hire us, which is also why we can tell you honestly when there's nothing worth filing."
          />
        </Container>
      </section>

      <Process title="One inspection, the whole exterior." steps={content.process} />

      <Reviews />

      <FaqSection faqs={content.faqs} title="Straight answers on exterior work." />

      <RelatedServices currentSlug="exterior" />

      <CtaBand
        heading="One inspection covers all of it."
        sub="Free, documented, and an honest verdict in writing, roof and everything under it."
      />
    </>
  );
}
