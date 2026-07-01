import type { Metadata } from "next";
import { Container, SectionHeading } from "@/components/ui";
import { PageHero, CtaBand, FeatureList } from "@/components/blocks";
import { FaqSection } from "@/components/service-blocks";
import { FinancingCalculator } from "@/components/FinancingCalculator";
import { Reviews } from "@/components/Reviews";

export const metadata: Metadata = {
  title: "Roof & Deductible Financing in DFW — $0 Down | PowerEdge",
  description:
    "Can't cover your roof deductible or out-of-pocket? Finance it — $0 down, low monthly payments, and we schedule the work now. Serving Dallas–Fort Worth. You pay your full deductible over time; we never waive it.",
};

const faqs = [
  {
    q: "Is financing my roof deductible legal in Texas?",
    a: "Yes. Texas law (HB 2102) bans a contractor from waiving, paying, or absorbing your deductible — but financing it is legal, because you still pay your full deductible over time. A payment plan is fully compliant; a waiver is a crime.",
  },
  {
    q: "Why is my deductible so high?",
    a: "Most Texas policies use a percentage wind/hail deductible — often 1–2% of your home's insured value. On a $400,000–$500,000 home that's $4,000–$10,000 out of pocket before work starts. That's exactly the gap financing is built to bridge.",
  },
  {
    q: "What payment plans do you offer?",
    a: "Two in-house plans, subject to approval: a 4-month plan at 0% interest, or a 12-month plan at 12.99% APR to keep the monthly payment lower. Final terms and required disclosures are provided in writing before you sign.",
  },
  {
    q: "Do I need money down?",
    a: "Often little or nothing down, depending on the plan and your credit approval. You spread your deductible (or the full project, if you're paying out of pocket) into monthly payments and we schedule the work now.",
  },
  {
    q: "Can you finance the whole roof, not just the deductible?",
    a: "Yes. If you don't have a claim — or your claim came in low on an older, actual-cash-value roof — we can finance the full project so you're not stuck waiting.",
  },
  {
    q: "I already have an estimate from another roofer. Can you still help?",
    a: "Absolutely. Bring the estimate. We can do the work and set you up with financing so the out-of-pocket isn't what stops you.",
  },
];

const steps = [
  "Free inspection — we document the damage for your claim",
  "You choose: finance your deductible, or the full project",
  "$0-down options with low monthly payments (subject to approval)",
  "We schedule the work now — you don't wait to save up",
];

export default function FinancingPage() {
  return (
    <>
      <PageHero
        kicker="Roof & deductible financing · Dallas–Fort Worth"
        title="Can't cover the out-of-pocket? Finance it — and get your roof done now."
        intro="A high deductible or a low insurance check shouldn't stand between you and a sound roof. We finance your deductible — or your whole project — with $0 down and low monthly payments, so we can schedule the work now instead of when you've saved up. You always pay your full deductible over time; we never waive it (that's illegal in Texas, and following the law protects you)."
        badge="Get financed & scheduled"
        withForm
      />

      {/* Calculator */}
      <section className="bg-paper py-20 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              kicker="See your payment"
              title="Turn a $8,000 wall into a monthly payment."
              intro="Enter your deductible (or your out-of-pocket) and see roughly what it looks like spread over time. The moment a lump sum becomes a manageable monthly number, you're no longer stuck."
            />
            <p className="mt-4 text-sm text-fg-dim">
              This is an illustrative estimate, not a financing offer — your
              actual payment depends on the plan you choose and credit approval.
              We&apos;ll walk you through the real options on your free
              inspection.
            </p>
          </div>
          <FinancingCalculator ctaHref="#quote" />
        </Container>
      </section>

      {/* Who it's for */}
      <section className="bg-ink py-16 sm:py-20">
        <Container>
          <SectionHeading
            dark
            kicker="Who this is for"
            title="If any of these is you, don't wait to save up."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              {
                h: "Approved, but the deductible's too steep",
                p: "Texas deductibles run 1–2% of home value — $5,000–$10,000 before work starts. Finance it and start now.",
              },
              {
                h: "Your insurance check came in low",
                p: "Older roofs get put on actual-cash-value — a depreciated check that doesn't cover the job. We finance the gap.",
              },
              {
                h: "No claim — you're paying out of pocket",
                p: "No storm claim? We can finance the full project so a new roof isn't a lump-sum decision.",
              },
              {
                h: "You've got solar in the mix",
                p: "If the detach & reset isn't fully covered, that cost doesn't have to stop you either.",
              },
            ].map((c) => (
              <div
                key={c.h}
                className="rounded-card border border-line bg-ink-2 p-6"
              >
                <h3 className="font-display text-lg font-bold text-fg-inv">
                  {c.h}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-fg-inv-dim">
                  {c.p}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-fg-inv-dim">
            <span aria-hidden>⏳</span>
            Storm damage worsens with every rain and Texas claims have filing
            deadlines — financing lets you get the roof done now, not months from
            now.
          </p>
        </Container>
      </section>

      {/* How it works */}
      <section className="bg-paper py-20 sm:py-28">
        <Container>
          <SectionHeading
            kicker="How it works"
            title="Four steps, no lump sum."
          />
          <div className="mt-10">
            <FeatureList items={steps} />
          </div>
        </Container>
      </section>

      <Reviews />

      <FaqSection faqs={faqs} title="Financing questions, answered straight." />

      <CtaBand
        heading="Stuck on the out-of-pocket? Let's fix that."
        sub="Free inspection, $0-down financing options, and we schedule the work now — you pay your full deductible over time, never waived."
      />
    </>
  );
}
