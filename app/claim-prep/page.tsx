import type { Metadata } from "next";
import { Container, Kicker } from "@/components/ui";
import { ClaimPrep } from "@/components/ClaimPrep";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Prep Your Roof Claim — PowerEdge",
  description:
    "Share your claim details ahead of your inspection so our crew arrives ready to inspect, document, and get you moving — not do paperwork on your doorstep.",
  robots: { index: false, follow: false },
};

export default function ClaimPrepPage() {
  return (
    <section className="relative overflow-hidden bg-ink py-14 sm:py-20">
      <div className="absolute inset-0 grid-texture opacity-60" />
      <Container className="relative max-w-2xl">
        <Kicker className="mb-5">2 minutes · Speeds up your inspection</Kicker>
        <h1 className="font-display text-3xl leading-tight text-fg-inv sm:text-4xl">
          Get your claim ready before we arrive.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-fg-inv-dim">
          Fill in a few details now and your crew shows up already knowing the
          scope — so the visit is about your roof and getting you scheduled, not
          paperwork on the doorstep. All optional except your name and phone.
        </p>
        <div className="mt-8 rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
          <ClaimPrep />
        </div>
        <p className="mt-6 text-sm text-fg-inv-dim">
          Licensed Texas contractor · TECL #{site.teclLicense} · Your details are
          used only to prepare your inspection.
        </p>
      </Container>
    </section>
  );
}
