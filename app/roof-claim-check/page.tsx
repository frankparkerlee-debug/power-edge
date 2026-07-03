import type { Metadata } from "next";
import { Container, Kicker } from "@/components/ui";
import { RoofClaimCheck } from "@/components/RoofClaimCheck";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Do You Have a Roof Insurance Claim? Free 60-Second Check — DFW",
  description:
    "Enter your address, answer three quick questions, and find out if your storm-damaged roof likely qualifies for an insurance claim. Free, instant, no obligation. Serving Dallas–Fort Worth.",
};

export default function RoofClaimCheckPage() {
  return (
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
            One address and three quick questions. We check reported hail near
            your home against National Weather Service data — the same kind of
            record an adjuster uses — and tell you if it&apos;s likely worth
            filing. Damage is easy to miss from the ground, and Texas claims have
            deadlines.
          </p>

          <ul className="mt-8 space-y-3 text-fg-inv-dim">
            {[
              "A straight yes/no read on whether it's worth filing",
              "On a covered claim, you typically pay only your deductible",
              "Can't cover it up front? Start for as little as $500 down",
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
            Licensed Texas contractor · TECL #{site.teclLicense} · We never waive
            deductibles or pose as your adjuster — that&apos;s the law, and it
            protects you.
          </p>
        </div>

        <RoofClaimCheck />
      </Container>
    </section>
  );
}
