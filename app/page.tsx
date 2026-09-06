import Link from "next/link";
import Image from "next/image";
import { Button, Container, Kicker, SectionHeading, Stars } from "@/components/ui";
import { LeadForm } from "@/components/LeadForm";
import { Reviews } from "@/components/Reviews";
import { Gallery } from "@/components/Gallery";
import { DeductibleFinancing } from "@/components/DeductibleFinancing";
import { FinancingCalculator } from "@/components/FinancingCalculator";
import { CountUp } from "@/components/CountUp";
import { ClaimCheckInline } from "@/components/ClaimCheckInline";
import { DfwHailActivity } from "@/components/DfwHailActivity";
import { site } from "@/lib/site";
import { services } from "@/lib/services";
import { cities } from "@/lib/cities";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustBar />
      <StormRestoration />
      <StuckBand />
      <Wedge />
      <DfwHailActivity />
      <ClaimCheckBand />
      <ServicesGrid />
      <Team />
      <Gallery />
      <Reviews />
      <ServiceAreas />
      <FinalCTA />
    </>
  );
}

/* ----------------------------------------------------------------- HERO */
function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink">
      <Image
        src="/photos/storm-home-v2.jpg"
        alt="Texas brick home under a dark storm sky"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[60%_center] opacity-90"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink to-transparent" />
      <div className="absolute inset-0 grid-texture opacity-25" />
      <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-bolt/10 blur-[120px]" />
      <Container className="relative grid items-center gap-14 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <Kicker className="mb-6">
            Roofing &amp; storm restoration · Dallas–Fort Worth
          </Kicker>
          <h1 className="font-display text-[2.7rem] leading-[0.95] text-fg-inv sm:text-6xl md:text-[4.2rem]">
            Storm damage?
            <br />
            <span className="bolt-underline">We can help with that.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-fg-inv-dim">
            Leak, missing shingles, hail — we inspect it free and tell you
            straight. If it&apos;s a covered storm claim, you likely pay just
            your <strong className="text-fg-inv">deductible</strong>, and we can
            finance that. Not a storm? We&apos;ll still get you an honest price.
          </p>

          {/* Conversion pillars — storm-first, financing */}
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-t border-line pt-6">
            {[
              { t: "Free roof inspection", d: "Storm claim or cash — honest read" },
              { t: "Deductible financing", d: "As little as $250 down" },
            ].map((p) => (
              <div key={p.t} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-bolt" />
                <div>
                  <div className="font-display text-sm font-bold uppercase tracking-wider text-fg-inv">
                    {p.t}
                  </div>
                  <div className="text-sm text-fg-inv-dim">{p.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <a
              href="/free-inspection"
              className="group rounded-card border border-line bg-ink-2 p-5 transition-colors hover:border-bolt"
            >
              <div className="font-display text-lg font-bold text-fg-inv">
                Book a free inspection
              </div>
              <div className="mt-0.5 text-sm text-fg-inv-dim">
                Documented for your claim — no cost, no pressure.
              </div>
              <div className="mt-2 font-display text-sm font-bold text-bolt">
                Get started →
              </div>
            </a>
            <a
              href="/roof-claim-check"
              className="group rounded-card border border-line bg-ink-2 p-5 transition-colors hover:border-bolt"
            >
              <div className="font-display text-lg font-bold text-fg-inv">
                Do I have a claim?
              </div>
              <div className="mt-0.5 text-sm text-fg-inv-dim">
                Free 60-second eligibility check.
              </div>
              <div className="mt-2 font-display text-sm font-bold text-bolt">
                Check my roof →
              </div>
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-fg-inv-dim">
            <span className="inline-flex items-center gap-2">
              <Stars />
              <strong className="text-fg-inv">{site.googleRating}</strong> (
              {site.googleReviewCount} reviews)
            </span>
            <span className="h-4 w-px bg-line" />
            <span>
              <strong className="text-fg-inv">Insured &amp; accountable</strong>
            </span>
            <span className="h-4 w-px bg-line" />
            <span>
              <strong className="text-fg-inv">20-year</strong> roofing
              project manager
            </span>
            <span className="h-4 w-px bg-line" />
            <span>
              <strong className="text-fg-inv">{site.liabilityCoverage}</strong>{" "}
              insured
            </span>
          </div>
        </div>

        {/* Lead capture card, right in the hero */}
        <div id="quote" className="scroll-mt-24">
          <div className="rounded-card border border-line bg-ink-2 p-7 shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-fg-inv">
              Book your free roof inspection
            </h2>
            <p className="mt-1.5 text-sm text-fg-inv-dim">
              Just your name and number — a real pro calls you back fast,
              usually within the hour.
            </p>
            <div className="mt-6">
              <LeadForm compact lean defaultService="Storm / insurance claim" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------- TRUST BAR */
function TrustBar() {
  const items = [
    {
      big: <>Insured</>,
      small: "& accountable Texas contractor",
    },
    {
      big: <CountUp to={site.capacity.crews} suffix=" crews" />,
      small: `~${site.capacity.roofsPerMonth} roofs / month capacity`,
    },
    {
      big: (
        <>
          <CountUp to={Number(site.googleRating)} decimals={1} />★
        </>
      ),
      small: `${site.googleReviewCount} Google reviews`,
    },
    { big: "1-yr", small: "workmanship guarantee" },
  ];
  return (
    <section className="border-y border-line bg-ink-2">
      <Container className="grid grid-cols-2 divide-x divide-line md:grid-cols-4">
        {items.map((it, i) => (
          <div key={i} className="px-4 py-7 text-center">
            <div className="font-display text-3xl font-extrabold text-bolt">
              {it.big}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-fg-inv-dim">
              {it.small}
            </div>
          </div>
        ))}
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------------- WEDGE */
function Wedge() {
  const bullets = [
    {
      h: "We're insured & accountable",
      p: `Backed by $2,000,000 in liability coverage and a documented 1-year workmanship guarantee — a real, accountable company, not a fly-by-night storm crew.`,
    },
    {
      h: "One accountable crew",
      p: "Our own crews handle your roof, inspection to final walk — no subcontractor finger-pointing.",
    },
    {
      h: "Built to show up, not just sign you up",
      p: "Four crews and capacity for up to 100 roofs a month mean we can actually be there this week — not in a month.",
    },
    {
      h: "We'll tell you if your roof is fine",
      p: "No manufactured damage, no scare inspections. If there's nothing worth claiming, you'll hear exactly that — in writing.",
    },
  ];
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            kicker="Why PowerEdge"
            title="The one contractor you can actually verify."
            intro="Texas doesn't license roofers. Anyone with a ladder and a magnet sign can knock your door after a storm. We hold ourselves to a higher bar anyway — insured and accountable as a company, with the reviews and workmanship guarantee to back it up."
          />
          <ul className="mt-8 space-y-5">
            {bullets.map((b) => (
              <li key={b.h} className="flex gap-4">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bolt">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-ink">
                    <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-fg">
                    {b.h}
                  </h3>
                  <p className="mt-0.5 text-fg-dim">{b.p}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Verify card */}
        <div className="rounded-card border border-paper-2 bg-ink p-9 text-fg-inv shadow-xl">
          <Kicker className="mb-5">Don&apos;t take our word</Kicker>
          <p className="font-display text-2xl font-bold leading-snug">
            A real company stands behind the work.
          </p>
          <p className="mt-3 text-fg-inv-dim">
            Every roof runs under one accountable, insured team — no
            subcontractor finger-pointing, and an honest verdict in writing
            even when the answer is &ldquo;your roof is fine.&rdquo;
          </p>
          <div className="mt-6 rounded-md border border-line bg-ink-2 p-5">
            <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
              Coverage
            </div>
            <div className="mt-1 font-display text-3xl font-extrabold text-bolt">
              {site.liabilityCoverage} liability
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------- SERVICES */
function ServicesGrid() {
  return (
    <section className="bg-ink py-20 sm:py-28">
      <Container>
        <SectionHeading
          dark
          kicker="What we do"
          title="Roofing, home repair, and commercial — one licensed, insured team."
          intro="Storm restoration and roof replacement for homes, home repair, and full commercial roofing for property managers. Free inspections, no runaround."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {services.map((s) => (
            <Link
              key={s.slug}
              href={`/${s.slug}`}
              className="group flex flex-col rounded-card border border-line bg-ink-2 p-8 transition-colors hover:border-bolt"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-2xl font-bold text-fg-inv">
                  {s.title}
                </h3>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    s.pricingMode === "transparent"
                      ? "bg-bolt/15 text-bolt"
                      : "bg-steel text-fg-inv-dim"
                  }`}
                >
                  {s.pricingMode === "transparent"
                    ? "Up-front pricing"
                    : "Free quote"}
                </span>
              </div>
              <p className="mt-3 text-fg-inv-dim">{s.blurb}</p>
              <ul className="mt-5 space-y-2 text-sm text-fg-inv-dim">
                {s.bullets.slice(0, 3).map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-bolt">—</span>
                    {b}
                  </li>
                ))}
              </ul>
              <span className="mt-6 font-display font-bold text-bolt opacity-0 transition-opacity group-hover:opacity-100">
                Explore {s.short} →
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------- CLAIM CHECK BAND */
function ClaimCheckBand() {
  return (
    <section className="bg-ink py-20 sm:py-28">
      <Container>
        <div className="overflow-hidden rounded-card border border-bolt/30 bg-gradient-to-br from-ink-2 to-ink shadow-xl">
          <div className="grid lg:grid-cols-2">
            <div className="p-9 sm:p-12">
              <Kicker className="mb-5">Free 60-second claim check</Kicker>
              <h2 className="font-display text-3xl font-bold leading-tight text-fg-inv sm:text-4xl">
                Do you have a roof claim? Find out before you call anyone.
              </h2>
              <p className="mt-4 text-fg-inv-dim">
                Enter your address and answer three quick questions. We check
                reported hail near your home and give you a straight read on
                whether it&apos;s likely worth filing — no salesperson, no
                obligation. On a covered claim, you typically pay just your
                deductible.
              </p>
              <ClaimCheckInline />
            </div>
            <div className="relative hidden border-l border-line bg-ink-2 p-12 lg:flex lg:items-center">
              <div className="w-full rounded-card border-2 border-bolt bg-bolt/10 p-6">
                <div className="text-xs font-bold uppercase tracking-wider text-bolt">
                  Good news
                </div>
                <div className="mt-2 font-display text-2xl font-extrabold leading-tight text-fg-inv">
                  You likely qualify for a roof insurance claim.
                </div>
                <div className="mt-4 rounded-md border border-line bg-ink p-3 text-sm text-fg-inv-dim">
                  3 hail reports within 15 mi · largest 2″ · ~7 months left to
                  file
                </div>
                <div className="mt-3 flex items-center justify-between rounded-md border border-line bg-ink p-3">
                  <span className="text-sm text-fg-inv-dim">Your out of pocket</span>
                  <span className="font-display text-lg font-extrabold text-bolt">
                    Just your deductible
                  </span>
                </div>
                <div className="mt-3 text-center text-sm text-fg-inv-dim">
                  Start for as little as{" "}
                  <span className="font-bold text-fg-inv">$250 down</span>.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------- STORM RESTORATION */
function StormRestoration() {
  const steps = [
    {
      h: "We inspect and document — free",
      p: "Photos, measurements, and a written damage assessment, so your claim is built on evidence, not guesswork.",
    },
    {
      h: "You file; we coordinate with your adjuster",
      p: "We meet your adjuster on-site and document the full scope so nothing legitimate gets missed. We don't act as your public adjuster — that's the law, and it protects you.",
    },
    {
      h: "You pay your deductible — we handle the roof",
      p: "On a covered claim you typically pay only your deductible. Short on it up front? Finance it into low monthly payments and start now.",
    },
  ];
  return (
    <section className="relative overflow-hidden bg-ink py-20 sm:py-28">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-ember" />
      <Container className="grid gap-12 lg:grid-cols-2 lg:items-start">
        <div>
          <p className="kicker text-ember">Storm &amp; hail damage</p>
          <h2 className="mt-4 font-display text-3xl font-bold text-fg-inv sm:text-4xl">
            Hail damage? We make the insurance claim simple — and by the book.
          </h2>
          <p className="mt-4 text-fg-inv-dim">
            A storm claim is where homeowners get burned by fly-by-night roofers.
            Here&apos;s how we do it differently: no waiving your deductible, no
            posing as your adjuster — just an honest claim and a roof done right.
          </p>
          <ol className="mt-8 space-y-5">
            {steps.map((s, i) => (
              <li key={s.h} className="flex gap-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bolt font-display text-sm font-extrabold text-ink">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-fg-inv">
                    {s.h}
                  </h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-fg-inv-dim">
                    {s.p}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <Button href="/roof-claim-check">Check if I have a claim →</Button>
          </div>
          <p className="mt-4 text-sm text-fg-inv-dim">
            Already know you&apos;re filing?{" "}
            <a href="/claim-prep" className="font-bold text-bolt hover:text-bolt-hi">
              Self-serve: prep your claim →
            </a>{" "}
            and we&apos;ll show up ready to fix it.
          </p>
        </div>

        <div className="lg:sticky lg:top-24">
          <DeductibleFinancing />
          <div className="mt-6 rounded-card border border-line bg-ink-2 p-6">
            <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
              What a storm claim usually looks like
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-fg-inv-dim">New roof (retail)</span>
                <span className="font-display font-bold text-fg-inv-dim line-through">
                  ~$15,000
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-3">
                <span className="text-fg-inv">Your out of pocket</span>
                <span className="font-display text-2xl font-extrabold text-bolt">
                  Just your deductible
                </span>
              </div>
              <p className="pt-1 text-xs leading-relaxed text-fg-inv-dim">
                On a covered claim with replacement-cost coverage. Your deductible
                depends on your policy — and you can finance it.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------- STUCK / FINANCING */
function StuckBand() {
  const cases = [
    "Deductible too high to front (Texas deductibles run 1–2% of home value)",
    "Insurance check came in low — older roof on actual-cash-value coverage",
    "No claim — paying out of pocket",
  ];
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            kicker="Stuck on the out-of-pocket?"
            title="Approved for a roof but can't cover the deductible? You're not stuck."
            intro="In Texas, a wind/hail deductible is often 1–2% of your home's value — $5,000–$10,000 out of pocket before work even starts. If that's the wall between you and a sound roof, we finance it: as little as $250 down, low monthly payments, and we get the job scheduled now. Already have an estimate from another roofer? Bring it — we'll do the work and finance it."
          />
          <ul className="mt-6 space-y-2.5">
            {cases.map((x) => (
              <li key={x} className="flex gap-2.5 text-fg-dim">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bolt-deep" />
                <span>{x}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <Button href="/financing">See financing options →</Button>
          </div>
        </div>
        <FinancingCalculator ctaHref="#quote" />
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------ TEAM */
function Team() {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <SectionHeading
          kicker="Who's on the truck"
          title="Real names. Real decades on the job."
          align="center"
        />
        <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
          {site.team.map((person) => (
            <div
              key={person.name}
              className="rounded-card border border-paper-2 bg-white p-8 shadow-sm"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink font-display text-xl font-extrabold text-bolt">
                {person.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-fg">
                {person.name}
              </h3>
              <p className="font-semibold text-bolt-deep">{person.role}</p>
              <p className="text-sm text-fg-dim">{person.cred}</p>
              <p className="mt-4 text-sm leading-relaxed text-fg-dim">
                {person.bio}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------- SERVICE AREAS */
function ServiceAreas() {
  return (
    <section className="bg-ink py-20 sm:py-28">
      <Container>
        <SectionHeading
          dark
          kicker="Where we work"
          title="Serving the DFW metroplex."
          align="center"
        />
        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-3">
          {cities.map((c) => (
            <Link
              key={c.slug}
              href={`/service-areas/${c.slug}`}
              className="rounded-full border border-line bg-ink-2 px-5 py-2.5 font-display text-sm font-bold text-fg-inv transition-colors hover:border-bolt hover:text-bolt"
            >
              {c.name}
            </Link>
          ))}
        </div>
        <p className="mt-8 text-center text-fg-inv-dim">
          Don&apos;t see your town? We cover all of {site.serviceArea}.{" "}
          <Link href="/contact" className="text-bolt hover:underline">
            Just ask.
          </Link>
        </p>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------------- FINAL CTA */
function FinalCTA() {
  return (
    <section className="bg-bolt py-20 sm:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
            Get a crew you can verify.
          </h2>
          <p className="mt-5 max-w-md text-lg text-ink/80">
            Free roof inspection, upfront pricing, and a real person
            on the phone. Tell us what&apos;s going on.
          </p>
          <div className="mt-8">
            <a
              href={site.phoneHref}
              className="font-display text-2xl font-extrabold text-ink"
            >
              {site.phone}
            </a>
          </div>
        </div>
        <div className="rounded-card bg-ink p-7 shadow-2xl">
          <LeadForm />
        </div>
      </Container>
    </section>
  );
}
