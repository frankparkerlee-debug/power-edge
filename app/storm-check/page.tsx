import type { Metadata } from "next";
import { Container, Kicker } from "@/components/ui";
import { StormCheck } from "@/components/StormCheck";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Free Hail & Storm Check — Did a Storm Hit Your Texas Roof?",
  description:
    "Enter your address and see reported hail activity near your home from National Weather Service storm data — free and instant. Then book a free roof inspection across DFW.",
};

export default function StormCheckPage() {
  return (
    <section className="relative overflow-hidden bg-ink py-14 sm:py-20">
      <div className="absolute inset-0 grid-texture opacity-60" />
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-ember/15 blur-[120px]" />
      <Container className="relative flex flex-col-reverse gap-10 lg:grid lg:grid-cols-[1fr_0.95fr] lg:items-start lg:gap-12">
        <div className="lg:pt-6">
          <Kicker className="mb-5">Free · Instant · NWS storm data</Kicker>
          <h1 className="font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl">
            Did a storm
            <br />
            <span className="bolt-underline">hit your roof?</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-fg-inv-dim">
            Enter your address and we&apos;ll pull reported hail activity near
            your home straight from National Weather Service storm data — the
            same kind of record an adjuster uses. Hail damage is often invisible
            from the ground, and Texas claims have deadlines.
          </p>

          <ul className="mt-8 space-y-3 text-fg-inv-dim">
            {[
              "See real reported hail size and dates near your address",
              "Know whether it's worth filing — before a deadline passes",
              "Free inspection, claim documented honestly and by the book",
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
            deductibles or play insurance games — that&apos;s the law, and it
            protects you.
          </p>
        </div>

        <StormCheck />
      </Container>
    </section>
  );
}
