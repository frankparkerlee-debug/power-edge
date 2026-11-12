import type { Metadata } from "next";
import { Container, Kicker, SectionHeading, Button } from "@/components/ui";
import { RepApply } from "@/components/RepApply";
import { FaqSection } from "@/components/service-blocks";
import { site } from "@/lib/site";

/**
 * Careers. Every pay figure here is the signed contractor agreement's
 * (lib/repAgreement.ts, version 2026-11-12). If that changes, this changes.
 */
export const metadata: Metadata = {
  alternates: { canonical: `${site.url}/careers` },
  title: "Roofing Sales Jobs in DFW: Knockers, Closers, Leaders",
  description:
    "Knock, close or lead in DFW storm roofing. Commission on gross profit with a cost basis fixed in your agreement, half paid at the first insurance check, and the hail record for every door.",
};

const roles = [
  {
    h: "Knocker",
    p: "Knock storm-hit streets and book free roof inspections in the app. No pricing, no contracts: a closer does that.",
    pay: "15% of gross profit on every approved roof you book, at least $500 per installed roof. $50 for every appointment you book that the homeowner keeps, paid weekly and counted toward your 15%.",
    who: "Self-starters. No roofing experience needed.",
  },
  {
    h: "Closer",
    p: "Run the inspections, give the homeowner a straight verdict in writing, price the work and sign it on your phone.",
    pay: "50% of gross profit on roofs you find yourself (55% from your 6th in a month), 35% on roofs your own knockers book, 30% on company leads. At least $1,250 per installed roof.",
    who: "Storm or in-home sales experience.",
  },
  {
    h: "Team lead",
    p: "A closer who runs 3 to 5 knockers: recruit them, ride along with them, keep their inspections moving.",
    pay: "Closer pay, with 35% instead of 30% on every roof your team books.",
    who: "Closers with a few months of approved roofs behind them.",
  },
  {
    h: "Regional leader",
    p: "Run several teams in one part of DFW: recruit team leads, move teams onto fresh hail, own the region's profit per roof.",
    pay: "An override on every approved roof your teams produce, paid from PowerEdge's share, never out of your reps' pay. Terms in conversation.",
    who: "Proven storm sales leaders, ideally with people who follow you.",
  },
];

const perks = [
  {
    h: "Paid at the first check. Not the last one.",
    p: "Half your commission when PowerEdge receives the first insurance check on the roof, the other half at completion. Weekly pay run.",
  },
  {
    h: "A redline that doesn't move",
    p: "Your commission comes from gross profit, and the cost side is fixed per square in your agreement. It doesn't change after a roof is sold, and supplements raise your share with it.",
  },
  {
    h: "You start where the hail was reported",
    p: "Other knockers work the whole neighborhood and say \"storms in the area.\" Our map shows every house in the path of reported hail, the date and stone size reported on each street, and in Dallas, which homes have a recent roof permit.",
  },
  {
    h: "Booked before you're off the porch",
    p: "Tap Book inspection and you see only the times a closer is actually free. The homeowner gets a confirmation and the closer gets the job before you reach the next door.",
  },
  {
    h: "No knocking a door your teammate already got a no on",
    p: "Every door you and your team mark shows up on everyone's map, so nobody burns an afternoon on the same street twice.",
  },
  {
    h: "Minimums that mean something",
    p: "$1,250 per installed roof for closers and $500 for knockers, even when the percentage comes to less.",
  },
  {
    h: "Numbers you can see",
    p: "Your numbers and your team's on a live scoreboard in the app, ranked, with a scorecard in your inbox every week.",
  },
  {
    h: "A company that finishes",
    p: `Insured and accountable, ${site.googleRating}★ rated, and the work is done by our own crews. Your customers get taken care of, so your name stays good.`,
  },
  {
    h: "A ladder, not a ceiling",
    p: "Knockers become closers. Closers run teams at 35%. Regional leaders earn on every roof in their region.",
  },
];

const faqs = [
  {
    q: "Is this commission-only?",
    a: "Yes. Everyone is a 1099 independent contractor paid on commission. New closers get $600 a week for their first 6 weeks as an advance against commission. Your commissions repay it first, and if you have 4 approved roofs by the end of week 8, whatever is left is forgiven. If you leave before it's repaid, you owe nothing.",
  },
  {
    q: "When do I get paid?",
    a: "Half your commission when PowerEdge receives the first insurance check on the roof (or the first payment on a cash job), the other half when the roof is complete and paid for. Knockers get $50 for every kept appointment on the weekly run.",
  },
  {
    q: "What is gross profit?",
    a: "Everything PowerEdge collects for the roof, including insurance payments and approved supplements, minus a fixed cost for each square installed. That cost is written into your agreement and doesn't change after a roof is sold, so you can work out your own commission.",
  },
  {
    q: "Do I have to knock doors?",
    a: "Knockers do: streets in the path of reported hail, with the date and stone size reported on each street in the app, and the city's solicitor permit before the first door. Closers run the inspections knockers book, and can find their own roofs at 50%.",
  },
  {
    q: "Do I need experience?",
    a: "Not to knock. We train you on the door, the app and the Texas rules, and you pass a short compliance check before your first door. Closers should have storm or in-home sales behind them.",
  },
  {
    q: "Is there a non-compete?",
    a: "No. For 12 months after you leave, you agree not to use PowerEdge's leads or homeowner information for anyone else. That's it.",
  },
];

export default function CareersPage() {
  return (
    <>
      {/* Hero + apply */}
      <section className="relative overflow-hidden bg-ink py-14 sm:py-20">
        <div className="absolute inset-0 grid-texture opacity-60" />
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-bolt/15 blur-[120px]" />
        <Container className="relative flex flex-col-reverse gap-10 lg:grid lg:grid-cols-[1fr_0.95fr] lg:items-start lg:gap-12">
          <div className="lg:pt-4">
            <Kicker className="mb-5">Now hiring · DFW · Knockers, closers, leaders</Kicker>
            <h1 className="font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl">
              Knock, close or lead.{" "}
              <span className="bolt-underline">The math is in writing.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-fg-inv-dim">
              You get paid from gross profit, and the cost side is fixed in your
              agreement, so nobody can move it after the sale. Half your commission
              lands at the first insurance check, not the last. And before you ring
              a doorbell, the app tells you the date and the size of the hail
              reported on that street.
            </p>

            <ul className="mt-8 space-y-3 text-fg-inv-dim">
              {[
                "Knockers: $50 for every appointment the homeowner keeps, paid weekly, toward 15% of gross profit on roofs you book",
                "Closers: 50% on roofs you find, 35% on your team's, 30% on company leads",
                "New closers: $600 a week for 6 weeks, an advance against commission",
                "A knock map of every house in the path of reported hail, with the date and stone size for each",
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
              Independent contractor (1099), commission-based · Insured &amp; accountable ·{" "}
              {site.googleRating}★ on Google.
            </p>
          </div>

          <div id="apply" className="scroll-mt-24">
            <RepApply />
          </div>
        </Container>
      </section>

      {/* The roles */}
      <section className="bg-ink-2 py-20 sm:py-24">
        <Container>
          <SectionHeading
            kicker="Four roles, one ladder"
            title="Start where you fit. Move up on numbers."
            dark
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {roles.map((r) => (
              <div key={r.h} className="rounded-card border border-line bg-ink p-6">
                <h3 className="font-display text-xl font-bold text-fg-inv">{r.h}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-inv-dim">{r.p}</p>
                <p className="mt-3 text-sm leading-relaxed text-fg-inv">
                  <strong className="text-bolt">Pay:</strong> {r.pay}
                </p>
                <p className="mt-2 text-xs text-fg-inv-dim">{r.who}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Why us */}
      <section className="bg-paper py-20 sm:py-28">
        <Container>
          <SectionHeading
            kicker="Why reps switch to us"
            title="A better deal than the shop you're at now."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {perks.map((c) => (
              <div
                key={c.h}
                className="rounded-card border border-paper-2 bg-white p-6 shadow-sm"
              >
                <h3 className="font-display text-lg font-bold text-fg">{c.h}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-dim">
                  {c.p}
                </p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-fg-dim">
            Independent contractor (1099), commission-based. Earnings depend on
            production and aren&apos;t guaranteed. Minimums apply to approved roofs
            that are installed. Advances are against commission and repaid only from
            commissions. Examples are illustrations, not promises. We don&apos;t take
            another company&apos;s customers or data.
          </p>
        </Container>
      </section>

      <FaqSection faqs={faqs} title="Rep questions, answered straight." />

      <section className="bg-ink py-20 sm:py-24">
        <Container className="text-center">
          <h2 className="font-display text-3xl font-extrabold leading-tight text-fg-inv sm:text-4xl">
            Ready to see the math?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-fg-inv-dim">
            Apply in 60 seconds, no résumé. Our sales lead will call you about the
            role, the territory and the numbers.
          </p>
          <div className="mt-8 flex justify-center">
            <Button href="#apply">Apply now →</Button>
          </div>
        </Container>
      </section>
    </>
  );
}
