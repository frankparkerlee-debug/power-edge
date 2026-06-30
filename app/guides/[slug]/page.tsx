import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container, Kicker } from "@/components/ui";
import { CtaBand } from "@/components/blocks";
import { FaqSection } from "@/components/service-blocks";
import { guides, getGuide } from "@/lib/guides";
import { site } from "@/lib/site";

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `${site.url}/guides/${g.slug}` },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.h1,
    description: g.description,
    datePublished: g.datePublished,
    author: { "@type": "Organization", name: site.legalName },
    publisher: {
      "@type": "Organization",
      name: site.legalName,
      logo: { "@type": "ImageObject", url: `${site.url}/brand/poweredge-icon.png` },
    },
    mainEntityOfPage: `${site.url}/guides/${g.slug}`,
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Guides", item: `${site.url}/guides` },
      { "@type": "ListItem", position: 2, name: g.h1, item: `${site.url}/guides/${g.slug}` },
    ],
  };

  const others = guides.filter((x) => x.slug !== g.slug);

  return (
    <>
      <article>
        {/* Hero */}
        <section className="relative overflow-hidden bg-ink">
          <div className="absolute inset-0 grid-texture opacity-60" />
          <Container className="relative py-14 sm:py-16">
            <Kicker className="mb-4">
              {g.category} · {g.readMins} min read
            </Kicker>
            <h1 className="max-w-3xl font-display text-3xl leading-[1.02] text-fg-inv sm:text-4xl md:text-5xl">
              {g.h1}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-inv-dim">
              {g.intro}
            </p>
          </Container>
        </section>

        {/* Body */}
        <section className="bg-paper py-16 sm:py-20">
          <Container className="max-w-3xl">
            <div className="space-y-10">
              {g.sections.map((s) => (
                <div key={s.h}>
                  <h2 className="font-display text-2xl font-bold text-fg">
                    {s.h}
                  </h2>
                  {s.p.map((para, i) => (
                    <p
                      key={i}
                      className="mt-3 leading-relaxed text-fg-dim"
                    >
                      {para}
                    </p>
                  ))}
                  {s.bullets && (
                    <ul className="mt-4 space-y-2">
                      {s.bullets.map((b) => (
                        <li key={b} className="flex gap-3 text-fg-dim">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bolt-deep" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {/* Related guides */}
            <div className="mt-14 border-t border-paper-2 pt-8">
              <h2 className="font-display text-lg font-bold text-fg">
                Keep reading
              </h2>
              <ul className="mt-4 space-y-2">
                {others.map((o) => (
                  <li key={o.slug}>
                    <Link
                      href={`/guides/${o.slug}`}
                      className="font-display font-bold text-bolt-deep hover:underline"
                    >
                      {o.h1} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      </article>

      <FaqSection faqs={g.faqs} title="Quick answers" />

      <CtaBand heading={g.cta.heading} sub={g.cta.sub} />

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
