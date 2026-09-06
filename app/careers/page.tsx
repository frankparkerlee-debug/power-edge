import type { Metadata } from "next";
import { Container, Kicker, SectionHeading, Button } from "@/components/ui";
import { RepApply } from "@/components/RepApply";
import { FaqSection } from "@/components/service-blocks";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Roofing Sales Jobs in DFW — Fast Pay, Leads, Real Tools | PowerEdge",
  description:
    "Sell storm-restoration roofs where the hustle actually pays: paid at the first check, a floor on every approved roof, storm-targeted leads, and the tools to close on the spot. Now hiring reps + a sales manager across Dallas–Fort Worth.",
};

const faqs = [
  {
    q: "Is this commission-only?",
    a: "Yes — 1099, commission-only, built for closers. But switching shops shouldn't cost you a month of income: proven closers get a $600/week ramp draw for the first 6 weeks, and if you close 4 approved roofs by week 8 the draw is forgiven — you keep it on top of your commissions. And every approved roof carries a floor, so a win never pays zero.",
  },
  {
    q: "When do I get paid?",
    a: "Fast. You get a solid chunk at the first insurance check, not months later at job completion, and we pay weekly. No commission games, no surprise deductions.",
  },
  {
    q: "Do I get leads or do I knock?",
    a: "Both. You'll work verified storm-hit areas from our own hail data instead of guessing, plus inbound leads as they come in — and a protected area so you're not fighting ten other reps for the same street.",
  },
  {
    q: "What tools do I get?",
    a: "An instant roof-claim check, satellite roof measurement, deductible financing to kill the 'I can't afford it' objection, and claim pre-fill so you can inspect and open the claim on-site. You close more per door with less effort.",
  },
  {
    q: "Do I need experience?",
    a: "This is a job for strong salespeople. Roofing experience is a plus but not required — if you've closed in solar, pest, alarms, or anywhere else, we'll teach you the roofing fast. Sales experience moves you to the front of the line.",
  },
];

const perks = [
  {
    h: "Get paid fast — and never at zero",
    p: "Paid at the first check, weekly, no games. Every approved roof carries a floor, so a slow week still pays.",
  },
  {
    h: "Backed by real storm data",
    p: "You work verified hail-hit areas, not random streets — plus a protected territory.",
  },
  {
    h: "Tools that close for you",
    p: "Instant claim check, satellite measurement, and deductible financing mean more yeses per door and bigger tickets.",
  },
  {
    h: "A company that delivers",
    p: `Licensed & insured, ${site.googleRating}★ rated, four crews and the capacity for ~${site.capacity.roofsPerMonth} roofs a month. Your customers get taken care of — your reputation is safe.`,
  },
  {
    h: "Real earnings, real ceiling",
    p: "50% of gross profit on your own deals against a fixed, published cost basis — and 55% from your 6th roof each month. No overhead skim, no moving redline, no cap.",
  },
  {
    h: "A ramp that respects closers",
    p: "$600/week forgivable draw for your first 6 weeks. Close 4 approved roofs by week 8 and you keep the draw on top of your commissions.",
  },
  {
    h: "A path up",
    p: "Top producers move into sales-manager roles with team overrides. Get in early and grow with us.",
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
            <Kicker className="mb-5">Now hiring · DFW · Commission + floor</Kicker>
            <h1 className="font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl">
              Sell roofs where the{" "}
              <span className="bolt-underline">hustle actually pays.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-fg-inv-dim">
              Tired of chasing commissions that show up late — or not at all? We
              pay you at the first check, put a floor under every approved roof,
              back you with verified storm data instead of guesswork, and hand you
              the tools to close on the spot. New company, better deal for reps.
            </p>

            <ul className="mt-8 space-y-3 text-fg-inv-dim">
              {[
                "50% of gross profit — 55% from your 6th roof each month",
                "$600/wk forgivable ramp draw for proven closers",
                "Paid weekly at the first check, plus a floor on every approved roof",
                "Storm-mapped doors with owner names + satellite roof measurement",
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
              Hiring reps + a sales manager across the DFW metroplex.
              Licensed & insured · {site.googleRating}★ on Google.
            </p>
          </div>

          <div id="apply" className="scroll-mt-24">
            <RepApply />
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
            Commission-only, 1099 independent contractor. Earnings depend on
            production and aren&apos;t guaranteed; the per-roof floor applies to
            approved roofs. Bring a valid non-compete-free status — we don&apos;t
            take another company&apos;s customers or data.
          </p>
        </Container>
      </section>

      <FaqSection faqs={faqs} title="Rep questions, answered straight." />

      <section className="bg-ink py-20 sm:py-24">
        <Container className="text-center">
          <h2 className="font-display text-3xl font-extrabold leading-tight text-fg-inv sm:text-4xl">
            Ready to actually get paid for closing?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-fg-inv-dim">
            Apply in 60 seconds — no résumé. Our sales lead will call you to talk
            territory and numbers.
          </p>
          <div className="mt-8 flex justify-center">
            <Button href="#apply">Apply now →</Button>
          </div>
        </Container>
      </section>
    </>
  );
}
