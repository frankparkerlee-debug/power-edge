import Link from "next/link";
import { Container, SectionHeading, Stars } from "./ui";
import { site } from "@/lib/site";
import { services } from "@/lib/services";
import type { Step, Faq } from "@/lib/serviceContent";

/** Compact trust strip — sits right under a service-page hero so a cold
 *  visitor sees credentials before scrolling. Dark, to continue the hero. */
export function ServiceTrustBar() {
  return (
    <section className="border-y border-line bg-ink-2">
      <Container className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 py-6 text-sm">
        <span className="inline-flex items-center gap-2 text-fg-inv-dim">
          <Stars />
          <strong className="text-fg-inv">{site.googleRating}</strong> (
          {site.googleReviewCount} Google reviews)
        </span>
        <Divider />
        <span className="text-fg-inv-dim">
          <strong className="text-fg-inv">Licensed</strong> &amp; insured
        </span>
        <Divider />
        <span className="text-fg-inv-dim">
          <strong className="text-fg-inv">{site.liabilityCoverage}</strong>{" "}
          insured
        </span>
        <Divider />
        <span className="text-fg-inv-dim">
          <strong className="text-fg-inv">1-year</strong> workmanship guarantee
        </span>
      </Container>
    </section>
  );
}

function Divider() {
  return <span className="hidden h-4 w-px bg-line sm:block" />;
}

/** Numbered "how it works" steps on a light section. */
export function Process({
  title,
  steps,
  kicker = "How it works",
}: {
  title: string;
  steps: Step[];
  kicker?: string;
}) {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <SectionHeading kicker={kicker} title={title} align="center" />
        <ol className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="rounded-card border border-paper-2 bg-white p-6 shadow-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-sm font-extrabold text-bolt">
                {i + 1}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-fg">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-dim">
                {s.desc}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/** FAQ accordion (native <details>, no JS) + FAQPage JSON-LD for rich results. */
export function FaqSection({
  faqs,
  title = "Questions, answered straight.",
}: {
  faqs: Faq[];
  title?: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section className="bg-ink py-20 sm:py-28">
      <Container className="max-w-3xl">
        <SectionHeading dark kicker="FAQ" title={title} align="center" />
        <div className="mt-10 divide-y divide-line border-y border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-bold text-fg-inv">
                {f.q}
                <span className="shrink-0 text-bolt transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-fg-inv-dim">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </section>
  );
}

/** Cross-links to the other services — keeps marketing visitors on-site. */
export function RelatedServices({ currentSlug }: { currentSlug: string }) {
  const others = services.filter((s) => s.slug !== currentSlug);
  return (
    <section className="bg-paper py-16">
      <Container>
        <h2 className="font-display text-xl font-bold text-fg">
          Explore our other services
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {others.map((s) => (
            <Link
              key={s.slug}
              href={`/${s.slug}`}
              className="group rounded-card border border-paper-2 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <h3 className="font-display text-lg font-bold text-fg">
                {s.short}
              </h3>
              <p className="mt-1 text-sm text-fg-dim">{s.blurb}</p>
              <span className="mt-3 inline-block font-display text-sm font-bold text-bolt-deep">
                Learn more →
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
