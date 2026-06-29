import type { Metadata } from "next";
import { Container, Kicker } from "@/components/ui";
import { CoverageCheck } from "@/components/CoverageCheck";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Free Roof Coverage Check — Is Your Texas Roof Still Fully Covered?",
  description:
    "Take the free 60-second check: find out if your roof is still on full replacement-cost coverage or has been downgraded to actual-cash-value by your insurer. Free inspection across DFW.",
};

export default function RoofCheckPage() {
  return (
    <section className="relative overflow-hidden bg-ink py-14 sm:py-20">
      <div className="absolute inset-0 grid-texture opacity-60" />
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-bolt/15 blur-[120px]" />
      <Container className="relative grid items-start gap-12 lg:grid-cols-[1fr_0.95fr]">
        <div className="lg:pt-6">
          <Kicker className="mb-5">Free · 60 seconds · No phone tree</Kicker>
          <h1 className="font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl">
            Is your Texas roof
            <br />
            <span className="bolt-underline">still fully covered?</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-fg-inv-dim">
            Most Texas homeowners don&apos;t find out their insurer quietly
            downgraded their aging roof to actual-cash-value until they file a
            claim — and the check is thousands short. Answer five quick questions
            and get an honest read on where you stand.
          </p>

          <ul className="mt-8 space-y-3 text-fg-inv-dim">
            {[
              "Find out if you're on replacement-cost or actual-cash-value",
              "Learn whether your roof age puts your coverage at risk",
              "Get a free on-site inspection + written coverage check",
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
            Backed by a licensed Texas electrical contractor · TECL #
            {site.teclLicense} · Rated {site.googleRating}★
          </p>
        </div>

        <CoverageCheck />
      </Container>
    </section>
  );
}
