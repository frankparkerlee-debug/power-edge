import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container, SectionHeading } from "@/components/ui";
import { CtaBand, FeatureList } from "@/components/blocks";
import { cities, getCity } from "@/lib/cities";
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
    title: `Roofing & Electrician in ${c.name}, TX`,
    description: `${c.blurb} Licensed (TECL #${site.teclLicense}), insured, and rated ${site.googleRating}★. Free roof inspections and up-front electrical pricing in ${c.name}.`,
  };
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
            Roofing & electrical in {c.name}, Texas.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-fg-inv-dim">
            {c.blurb}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="#quote"
              className="inline-flex items-center justify-center rounded-md bg-bolt px-6 py-3.5 font-display font-bold text-ink hover:bg-bolt-hi"
            >
              Get a free quote in {c.name}
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
            title={`What we do in ${c.name}.`}
            intro={`The same licensed crew, the same standard, right here in ${c.county}.`}
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
                `Free roof inspections across ${c.name}`,
                "Up-front, published electrical pricing",
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

      <CtaBand
        heading={`Get a free quote in ${c.name}.`}
        sub="Roofing, electrical, or storm claim — tell us what's going on and we'll be in touch fast."
      />
    </>
  );
}
