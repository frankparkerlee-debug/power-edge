import type { Metadata } from "next";
import { Container, SectionHeading } from "@/components/ui";
import { PageHero, CtaBand } from "@/components/blocks";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About — Insured & Accountable Roofing & Home Repair in Texas",
  description:
    "PowerEdge is an insured, accountable company doing roofing and home repair across DFW. Meet the team behind the work.",
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        kicker="About PowerEdge"
        title="Built on real credentials."
        intro="Texas doesn't license roofers — so the bar to call yourself one is a magnet sign. We built PowerEdge on the opposite idea: real credentials, real people, and the receipts to prove it."
        badge="Work with us"
      />

      {/* Story */}
      <section className="bg-paper py-20 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <SectionHeading
              kicker="Our standard"
              title="No sales pitch. No gimmicks."
            />
            <div className="mt-6 space-y-4 text-fg-dim">
              <p>
                PowerEdge serves the Dallas–Fort Worth metroplex as an
                insured, accountable roofing and home repair contractor.
                Texas doesn&apos;t require a state license to call yourself a
                roofer — so we hold ourselves to a higher standard anyway.
              </p>
              <p>
                Every job runs under the same accountable company: a
                seasoned roofing project manager on every crew, a documented
                1-year workmanship guarantee, and $2,000,000 in liability
                coverage behind the work.
              </p>
              <p>
                We&apos;ll be straight with you: our service slipped at the end
                of last year as we grew. We owned it, restructured the crews,
                and we&apos;re earning back every star. The reviews you read are
                real, and so is the work behind them.
              </p>
            </div>
          </div>

          {/* Verify card */}
          <div className="rounded-card border border-paper-2 bg-ink p-8 text-fg-inv shadow-xl">
            <p className="kicker text-bolt">The company</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-md border border-line bg-ink-2 p-5">
                <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
                  Capacity
                </div>
                <div className="mt-1 font-display text-2xl font-extrabold text-bolt">
                  {site.capacity.crews} crews · {site.capacity.roofsPerMonth} roofs/mo
                </div>
              </div>
              <div className="rounded-md border border-line bg-ink-2 p-5">
                <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
                  Insurance
                </div>
                <div className="mt-1 font-display text-2xl font-extrabold text-fg-inv">
                  {site.liabilityCoverage} liability
                </div>
              </div>
              <div className="rounded-md border border-line bg-ink-2 p-5">
                <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
                  Guarantee
                </div>
                <div className="mt-1 font-display text-2xl font-extrabold text-fg-inv">
                  1-year workmanship
                </div>
              </div>
            </div>
            <a
              href={site.phoneHref}
              className="mt-6 inline-flex font-display font-bold text-bolt hover:text-bolt-hi"
            >
              Questions? Call or text us →
            </a>
          </div>
        </Container>
      </section>

      {/* Team */}
      <section className="bg-ink py-20 sm:py-28">
        <Container>
          <SectionHeading
            dark
            kicker="The team"
            title="Decades on the job, not just on the truck."
            align="center"
          />
          <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
            {site.team.map((person) => (
              <div
                key={person.name}
                className="rounded-card border border-line bg-ink-2 p-8"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bolt font-display text-xl font-extrabold text-ink">
                  {person.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <h3 className="mt-5 font-display text-xl font-bold text-fg-inv">
                  {person.name}
                </h3>
                <p className="font-semibold text-bolt">{person.role}</p>
                <p className="text-sm text-fg-inv-dim">{person.cred}</p>
                <p className="mt-4 text-sm leading-relaxed text-fg-inv-dim">
                  {person.bio}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
