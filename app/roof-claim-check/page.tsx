import type { Metadata } from "next";
import { Container, Kicker, SectionHeading } from "@/components/ui";
import { RoofClaimCheck } from "@/components/RoofClaimCheck";
import { ServiceTrustBar, FaqSection } from "@/components/service-blocks";
import { Reviews } from "@/components/Reviews";
import { CtaBand } from "@/components/blocks";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Do You Have a Roof Insurance Claim? Free Check — DFW",
  description:
    "Enter your address and find out in seconds if your storm-damaged roof likely qualifies for an insurance claim — free, no obligation. Then book a free inspection. Serving Dallas–Fort Worth. TECL #39773.",
};

const faqs = [
  {
    q: "Is the check really free?",
    a: "Completely. We check public National Weather Service hail reports against your address and give you a straight read — no cost, no obligation, no phone call required to see it.",
  },
  {
    q: "Does reported hail mean I automatically have a claim?",
    a: "No — it means it's worth a closer look. Whether you have a claim depends on the actual damage and your policy. A free inspection documents it and confirms; we never pretend to be your adjuster.",
  },
  {
    q: "What does the inspection cost?",
    a: "Nothing. A licensed pro photographs and measures your roof and gives you an honest read. If there's damage worth claiming, we document it for your adjuster. If not, we tell you straight.",
  },
  {
    q: "What if I can't cover my deductible?",
    a: "On a covered claim you typically pay only your deductible — and if that's tough up front, we can finance it from as little as $250 down. You still pay it in full over time; waiving deductibles is illegal in Texas and we never do it.",
  },
  {
    q: "I have solar. Can you still do the roof?",
    a: "Yes — that's a strength. Most roofers can't legally touch your panels, so they sub it out. We detach and reset them in-house under our electrical license, and it's usually a covered line item on your claim.",
  },
];

const steps = [
  {
    h: "Check your address",
    p: "Seconds, free. We pull reported hail near your home from NWS storm data.",
  },
  {
    h: "Book your free inspection",
    p: "A licensed pro documents your roof — photos, measurements, an honest read.",
  },
  {
    h: "We handle the rest",
    p: "If it's a claim, you pay just your deductible (financing from $250 down). If not, an honest price.",
  },
];

export default function RoofClaimCheckPage() {
  return (
    <>
      {/* Hero + tool */}
      <section className="relative overflow-hidden bg-ink py-14 sm:py-20">
        <div className="absolute inset-0 grid-texture opacity-60" />
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-ember/15 blur-[120px]" />
        <Container className="relative flex flex-col-reverse gap-10 lg:grid lg:grid-cols-[1fr_0.95fr] lg:items-start lg:gap-12">
          <div className="lg:pt-6">
            <Kicker className="mb-5">Free · Instant · No obligation</Kicker>
            <h1 className="font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl">
              Do you have
              <br />
              <span className="bolt-underline">a roof claim?</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-fg-inv-dim">
              Enter your address — we check reported hail near your home against
              National Weather Service data (the same kind of record an adjuster
              uses) and tell you on the spot if it&apos;s likely worth filing.
              Hail damage is nearly invisible from the ground — and once your
              policy&apos;s filing window closes, the whole roof comes out of
              your pocket, not your deductible.
            </p>

            <ul className="mt-8 space-y-3 text-fg-inv-dim">
              {[
                "A straight read on whether it's worth filing",
                "On a covered claim, you typically pay only your deductible",
                "Can't cover it up front? Start for as little as $250 down",
                "Got solar? We handle the panels too — most roofers can't",
                "Free inspection, documented honestly and by the book",
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

          <RoofClaimCheck />
        </Container>
      </section>

      <ServiceTrustBar />

      {/* How it works */}
      <section className="bg-paper py-20 sm:py-28">
        <Container>
          <SectionHeading
            kicker="How it works"
            title="Three steps, no pressure."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.h}
                className="rounded-card border border-paper-2 bg-white p-6 shadow-sm"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-sm font-extrabold text-bolt">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-fg">
                  {s.h}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-fg-dim">
                  {s.p}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <Reviews />

      <FaqSection faqs={faqs} title="Roof-claim questions, answered straight." />

      <CtaBand
        heading="Don't wait for the leak to prove the damage."
        sub="Free inspection, documented for your claim, deductible financing from $250 down — and we move before your filing window closes. On a covered claim you pay just your deductible."
      />
    </>
  );
}
