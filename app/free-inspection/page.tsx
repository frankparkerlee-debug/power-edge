import type { Metadata } from "next";
import Link from "next/link";
import { Container, Kicker, SectionHeading } from "@/components/ui";
import { LeadForm } from "@/components/LeadForm";
import { FaqSection } from "@/components/service-blocks";
import { Reviews } from "@/components/Reviews";
import { CtaBand } from "@/components/blocks";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Free Roof Inspection in DFW — Documented for Your Claim",
  description:
    "Book a free, no-obligation roof inspection across Dallas–Fort Worth. We photograph and document storm damage for your insurance claim, and tell you straight if your roof is fine. Licensed — TECL #39773.",
};

const faqs = [
  {
    q: "Is the inspection really free?",
    a: "Yes — free and no-obligation. We inspect, photograph, and document your roof, and give you an honest read. If your roof is fine, we'll tell you that.",
  },
  {
    q: "Do I have to file a claim?",
    a: "No. The inspection just tells you where you stand. If there's damage worth claiming we'll document it for your adjuster, but the decision is always yours.",
  },
  {
    q: "How long does it take?",
    a: "Most inspections take 30–45 minutes. We can usually get out within a few days — sooner after a storm if you're on the calendar early.",
  },
  {
    q: "What do I get?",
    a: "Photos, measurements, and a written assessment of any storm or hail damage — the evidence your claim is built on. Plus a straight answer, not a sales pitch.",
  },
  {
    q: "Will you try to sell me a roof I don't need?",
    a: "No. Texas doesn't license roofers, so plenty of storm-chasers manufacture damage. We're a licensed contractor (TECL #" + site.teclLicense + ") you can verify — our reputation depends on being straight with you.",
  },
];

const steps = [
  {
    h: "You book in under a minute",
    p: "Name and number is all we need to get you on the schedule.",
  },
  {
    h: "A licensed pro inspects your roof",
    p: "We get up there, check for hail and wind damage, and photograph everything — including your solar if you have it.",
  },
  {
    h: "We document it for your claim",
    p: "Measurements and a written damage assessment your adjuster can work from.",
  },
  {
    h: "You get a straight answer",
    p: "Real damage worth claiming, or a clean bill of health. No pressure either way.",
  },
];

export default function FreeInspectionPage() {
  return (
    <>
      {/* Hero + form */}
      <section className="relative overflow-hidden bg-ink py-14 sm:py-20">
        <div className="absolute inset-0 grid-texture opacity-60" />
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-bolt/15 blur-[120px]" />
        <Container className="relative flex flex-col-reverse gap-10 lg:grid lg:grid-cols-[1fr_0.95fr] lg:items-start lg:gap-12">
          <div className="lg:pt-4">
            <Kicker className="mb-5">Free · No obligation · Licensed</Kicker>
            <h1 className="font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl">
              Your free roof inspection —{" "}
              <span className="bolt-underline">booked in minutes.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-fg-inv-dim">
              A licensed pro gets on your roof, photographs and documents any
              storm damage for your claim, and gives you a straight answer — even
              if that answer is &ldquo;your roof is fine.&rdquo; No cost, no
              pressure, no storm-chaser games.
            </p>

            <ul className="mt-8 space-y-3 text-fg-inv-dim">
              {[
                "Photos, measurements, and a written damage report",
                "Documented the way your adjuster needs it",
                "On a covered claim, you typically pay just your deductible",
                "We handle your solar too — most roofers can't",
              ].map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bolt">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-ink">
                      <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
                    </svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            <p className="mt-8 text-sm text-fg-inv-dim">
              Licensed Texas contractor · TECL #{site.teclLicense} ·{" "}
              {site.googleRating}★ ({site.googleReviewCount} reviews) · We never
              waive deductibles or pose as your adjuster.
            </p>
          </div>

          {/* Capture card */}
          <div id="quote" className="scroll-mt-24">
            <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-7">
              <h2 className="font-display text-2xl font-bold text-fg-inv">
                Book your free inspection
              </h2>
              <p className="mt-1.5 text-sm text-fg-inv-dim">
                A real person calls you back fast — usually within the hour
                during business hours.
              </p>
              <div className="mt-5">
                <LeadForm compact defaultService="Free roof inspection" />
              </div>
            </div>

            {/* Claim-checker CTA box, right next to the inspection form */}
            <Link
              href="/roof-claim-check"
              className="mt-4 flex items-center justify-between rounded-card border border-line bg-ink-2 p-5 transition-colors hover:border-bolt"
            >
              <div>
                <div className="font-display text-base font-bold text-fg-inv">
                  Not sure you have damage?
                </div>
                <div className="mt-0.5 text-sm text-fg-inv-dim">
                  Run the free 60-second claim check first.
                </div>
              </div>
              <span className="font-display font-bold text-bolt">→</span>
            </Link>
          </div>
        </Container>
      </section>

      {/* What happens */}
      <section className="bg-paper py-20 sm:py-28">
        <Container>
          <SectionHeading
            kicker="What to expect"
            title="Four steps, zero pressure."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {steps.map((s, i) => (
              <div
                key={s.h}
                className="flex gap-4 rounded-card border border-paper-2 bg-white p-6 shadow-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-extrabold text-bolt">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-fg">
                    {s.h}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-fg-dim">
                    {s.p}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Trust */}
      <section className="bg-ink py-16 sm:py-20">
        <Container className="grid gap-8 md:grid-cols-3">
          {[
            {
              h: "Verify us before you trust us",
              p: `Texas doesn't license roofers — anyone can knock. We're a licensed electrical contractor, TECL #${site.teclLicense}, on the state's public portal.`,
            },
            {
              h: "One accountable crew",
              p: "Your roof and the electrical it touches — including solar detach & reset — handled in-house. No finger-pointing.",
            },
            {
              h: "Rated by North Texas homeowners",
              p: `${site.googleRating}★ across ${site.googleReviewCount} Google reviews, with the capacity to actually show up this week.`,
            },
          ].map((c) => (
            <div key={c.h}>
              <h3 className="font-display text-lg font-bold text-fg-inv">
                {c.h}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-inv-dim">
                {c.p}
              </p>
            </div>
          ))}
        </Container>
      </section>

      <Reviews />

      <FaqSection faqs={faqs} title="Your inspection, questions answered." />

      <CtaBand
        heading="Book your free roof inspection."
        sub="A licensed pro, an honest read, and documentation for your claim — at no cost. Tell us where to come."
      />
    </>
  );
}
