import type { Metadata } from "next";
import Link from "next/link";
import { Container, Kicker } from "@/components/ui";
import { CtaBand } from "@/components/blocks";
import { guides } from "@/lib/guides";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Roofing & Electrical Guides for Texas Homeowners",
  description:
    "Straight answers on roof replacement cost, Texas hail insurance claims, and how to vet a roofer — from a licensed DFW contractor.",
  alternates: { canonical: `${site.url}/guides` },
};

export default function GuidesIndexPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0 grid-texture opacity-60" />
        <Container className="relative py-14 sm:py-20">
          <Kicker className="mb-4">Homeowner guides</Kicker>
          <h1 className="max-w-3xl font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl">
            Straight answers, no sales pitch.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-fg-inv-dim">
            What roofs cost, how Texas hail claims really work, and how to hire a
            crew you can trust — from a licensed DFW contractor.
          </p>
        </Container>
      </section>

      <section className="bg-paper py-16 sm:py-20">
        <Container>
          <div className="grid gap-5 md:grid-cols-3">
            {guides.map((g) => (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="group flex flex-col rounded-card border border-paper-2 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="kicker text-bolt-deep">{g.category}</span>
                <h2 className="mt-3 font-display text-xl font-bold leading-snug text-fg">
                  {g.h1}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-fg-dim">
                  {g.description}
                </p>
                <span className="mt-4 font-display text-sm font-bold text-bolt-deep">
                  Read the guide →
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
