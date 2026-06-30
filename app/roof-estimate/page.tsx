import type { Metadata } from "next";
import { Container, Kicker } from "@/components/ui";
import { RoofEstimate } from "@/components/RoofEstimate";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Instant Roof Replacement Estimate — Measured From Your Address",
  description:
    "Get a ballpark roof replacement price in seconds. We measure your roof from aerial data and price it transparently — most roofers make you wait for a sales call. Free exact quote across DFW.",
};

export default function RoofEstimatePage() {
  return (
    <section className="relative overflow-hidden bg-ink py-14 sm:py-20">
      <div className="absolute inset-0 grid-texture opacity-60" />
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-bolt/15 blur-[120px]" />
      <Container className="relative grid items-start gap-12 lg:grid-cols-[1fr_0.95fr]">
        <div className="lg:pt-6">
          <Kicker className="mb-5">Free · Instant · No sales call</Kicker>
          <h1 className="font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl">
            What does a new
            <br />
            <span className="bolt-underline">roof actually cost?</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-fg-inv-dim">
            Most roofers dodge the question until they&apos;ve got a salesperson
            in your living room. We don&apos;t. Enter your address, we measure
            your roof from aerial data, and you get an honest ballpark range on
            the spot.
          </p>

          <ul className="mt-8 space-y-3 text-fg-inv-dim">
            {[
              "Your roof measured from your address — in seconds",
              "Transparent pricing at our published per-square rate",
              "If it's a storm claim, you likely pay just your deductible",
              "Free exact on-site measurement and written quote",
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
            Licensed Texas roofing & electrical · TECL #{site.teclLicense} ·
            Rated {site.googleRating}★
          </p>
        </div>

        <RoofEstimate />
      </Container>
    </section>
  );
}
