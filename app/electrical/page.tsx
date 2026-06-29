import type { Metadata } from "next";
import { Container, SectionHeading } from "@/components/ui";
import { PageHero, CtaBand } from "@/components/blocks";
import {
  ServiceTrustBar,
  Process,
  FaqSection,
  RelatedServices,
} from "@/components/service-blocks";
import { Reviews } from "@/components/Reviews";
import { electricalMenu, getService } from "@/lib/services";
import { getServiceContent } from "@/lib/serviceContent";
import { site } from "@/lib/site";

const service = getService("electrical")!;
const content = getServiceContent("electrical")!;

export const metadata: Metadata = {
  title: "Electrician in DFW — Up-Front Pricing",
  description:
    "Licensed electrician serving Dallas–Fort Worth. Panel upgrades, EV chargers, breaker and outlet repair — with prices published up front. TECL #" +
    site.teclLicense +
    ".",
};

export default function ElectricalPage() {
  return (
    <>
      <PageHero
        kicker="Electrical · Up-front pricing"
        title="Licensed electrical service with prices you can see."
        intro="Run under John Lott's 40-year Master Electrician license. Same-day service, honest flat-rate pricing, and no surprise invoices — the opposite of how most electrical work gets quoted."
        badge="Book a service call"
        withForm
      />

      <ServiceTrustBar />

      {/* Pricing menu */}
      <section className="bg-paper py-20 sm:py-28">
        <Container>
          <SectionHeading
            kicker="The price list"
            title="What common electrical jobs cost."
            intro="Transparent flat rates so you can compare before anyone steps inside. Bigger jobs are quoted free, on site, before any work begins."
          />

          <div className="mt-12 space-y-10">
            {electricalMenu.map((group) => (
              <div key={group.group}>
                <h3 className="font-display text-xl font-bold text-fg">
                  {group.group}
                </h3>
                <div className="mt-4 overflow-hidden rounded-card border border-paper-2 bg-white shadow-sm">
                  {group.items.map((item, i) => (
                    <div
                      key={item.job}
                      className={`flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between ${
                        i > 0 ? "border-t border-paper-2" : ""
                      }`}
                    >
                      <div className="sm:max-w-xl">
                        <div className="font-display text-lg font-bold text-fg">
                          {item.job}
                        </div>
                        <p className="text-sm text-fg-dim">{item.detail}</p>
                        {item.note && (
                          <p className="mt-1 text-xs font-medium text-bolt-deep">
                            {item.note}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 font-display text-2xl font-extrabold text-fg">
                        {item.price}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 max-w-2xl text-sm text-fg-dim">
            Prices shown are typical starting rates for North Texas and may vary
            with access, materials, and code requirements — you&apos;ll always
            get a firm number before we begin. Permits and inspections included
            where required.
          </p>
        </Container>
      </section>

      {/* What we do */}
      <section className="bg-ink py-20 sm:py-28">
        <Container>
          <SectionHeading
            dark
            kicker="Capabilities"
            title="Residential, commercial, industrial."
            intro={service.blurb}
          />
          <div className="mt-10">
            <FeatureListDark
              items={[
                ...service.bullets,
                "Industrial installs, upgrades & 24/7 emergency support",
                "Code corrections and inspection-ready work",
              ]}
            />
          </div>
        </Container>
      </section>

      <Process
        title="Fast, licensed, and priced up front."
        steps={content.process}
      />

      <Reviews />

      <FaqSection
        faqs={content.faqs}
        title="Electrical questions, answered straight."
      />

      <RelatedServices currentSlug="electrical" />

      <CtaBand
        heading="Need an electrician today?"
        sub="A licensed electrician to your door, a problem diagnosed, and a written price before any work."
      />
    </>
  );
}

/** Dark-background feature list variant. */
function FeatureListDark({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((b) => (
        <li
          key={b}
          className="flex gap-3 rounded-card border border-line bg-ink-2 p-5"
        >
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bolt">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-ink">
              <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
            </svg>
          </span>
          <span className="text-fg-inv-dim">{b}</span>
        </li>
      ))}
    </ul>
  );
}
