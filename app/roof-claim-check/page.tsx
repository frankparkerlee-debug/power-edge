import type { Metadata } from "next";
import Image from "next/image";
import { Container, Kicker, SectionHeading } from "@/components/ui";
import { RoofClaimCheck } from "@/components/RoofClaimCheck";
import { HonestyStandard } from "@/components/HonestyStandard";
import { ServiceTrustBar, FaqSection } from "@/components/service-blocks";
import { Reviews } from "@/components/Reviews";
import { CtaBand } from "@/components/blocks";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: `${site.url}/roof-claim-check` },
  title: "Did Hail Hit Near Your Home? Free DFW Roof Check",
  description:
    "Enter your address and see the hail the National Weather Service reported near your home, in seconds. Free, no obligation.",
};

const faqs = [
  {
    q: "Is the check really free?",
    a: "Completely. We check public National Weather Service hail reports against your address and give you a straight read, no cost, no obligation, no phone call required to see it.",
  },
  {
    q: "Does reported hail mean I automatically have a claim?",
    a: "No. It means it's worth a closer look. Whether there's damage depends on your roof, and whether it's covered depends on your policy. A free inspection tells you what's actually up there, and you decide whether to file. We never act as your adjuster.",
  },
  {
    q: "What does the inspection cost?",
    a: "Nothing. One of our pros photographs and measures your roof and gives you an honest read. If there's storm damage, we document it so you can show your adjuster. If not, we tell you straight.",
  },
  {
    q: "What if I can't cover my deductible?",
    a: "On a covered claim you typically pay only your deductible, and if that's tough up front, we can finance it from as little as $250 down. You still pay it in full over time; waiving deductibles is illegal in Texas and we never do it.",
  },
];

const steps = [
  {
    h: "Check your address",
    p: "Seconds, free. We pull reported hail near your home from NWS storm data.",
  },
  {
    h: "Book your free inspection",
    p: "One of our pros documents your roof, photos, measurements, an honest read.",
  },
  {
    h: "You decide what's next",
    p: "The verdict comes in writing. If you file, the claim is yours and we document the damage. On a covered claim you pay your deductible (financing from $250 down). If not, an honest price.",
  },
];

export default function RoofClaimCheckPage() {
  return (
    <>
      {/* Hero + tool */}
      <section className="relative overflow-hidden bg-ink py-14 sm:py-20">
        <Image
          src="/photos/hail-shingles-v3.jpg"
          alt="Hailstones on asphalt roof shingles after a Texas storm"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/60 to-ink/15" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink to-transparent" />
        <div className="absolute inset-0 grid-texture opacity-25" />
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-ember/15 blur-[120px]" />
        <Container className="relative flex flex-col-reverse gap-10 lg:grid lg:grid-cols-[1fr_0.95fr] lg:items-start lg:gap-12">
          <div className="lg:pt-6">
            <Kicker className="mb-5">Free · Instant · No obligation</Kicker>
            <h1 className="font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl">
              Adjusters work from{" "}
              <br />
              <span className="bolt-underline">the record.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-fg-inv-dim">
              So do we. The checker reads the National Weather Service hail
              reports for your exact address and shows you, on the spot, what
              was reported near your home. Hail damage is nearly invisible from
              the ground, and many policies set a deadline for reporting it,
              counted from the date of the storm.
            </p>

            <ul className="mt-8 space-y-3 text-fg-inv-dim">
              {[
                "What's on record near your home, in seconds",
                "On a covered claim, you typically pay only your deductible",
                "Can't cover it up front? Start for as little as $250 down",
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
              Insured & accountable Texas contractor ·{" "}
              {site.googleRating}★ ({site.googleReviewCount} reviews) · We never
              waive deductibles or pose as your adjuster.
            </p>
          </div>

          <RoofClaimCheck />
        </Container>
      </section>

      <ServiceTrustBar />

      <HonestyStandard />

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

      {/* Start-your-claim funnel entry (progressive intake) */}
      <section className="bg-ink py-16 sm:py-20">
        <Container className="text-center">
          <h2 className="font-display text-3xl font-bold text-fg-inv sm:text-4xl">
            Have your policy handy? Add it now.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-fg-inv-dim">
            Add your carrier and deductible and we arrive ready to inspect and
            document, not do paperwork on your doorstep. About two minutes.
            Your deductible can be financed from $250 down.
          </p>
          <a
            href="/claim-prep"
            className="mt-7 inline-block rounded-md bg-bolt px-7 py-4 font-display text-base font-extrabold text-ink transition-colors hover:bg-bolt-hi"
          >
            Add my policy details →
          </a>
          <p className="mt-3 text-xs text-fg-inv-dim">
            Insured contractor, not a public adjuster. We document &amp;
            coordinate; you file with your insurer.
          </p>
        </Container>
      </section>

      <CtaBand
        heading="Don't wait for the leak to prove the damage."
        sub="Free inspection, the verdict in writing, and deductible financing from $250 down. On a covered claim you pay your deductible, and the decision to file is always yours."
      />
    </>
  );
}
