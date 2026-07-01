import Link from "next/link";
import { Button, Container, Kicker, SectionHeading, Stars } from "@/components/ui";
import { LeadForm } from "@/components/LeadForm";
import { Reviews } from "@/components/Reviews";
import { Gallery } from "@/components/Gallery";
import { DeductibleFinancing } from "@/components/DeductibleFinancing";
import { FinancingCalculator } from "@/components/FinancingCalculator";
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
      <SolarReadyBand />
      <RoofCheckBand />
      <RoofEstimateBand />
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
      <div className="absolute inset-0 grid-texture opacity-70" />
      <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-bolt/20 blur-[120px]" />
      <Container className="relative grid items-center gap-14 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <Kicker className="mb-6">
            Storm &amp; hail roof restoration · Dallas–Fort Worth
          </Kicker>
          <h1 className="font-display text-[2.7rem] leading-[0.95] text-fg-inv sm:text-6xl md:text-[4.2rem]">
            Hail hit your roof?
            <br />
            <span className="bolt-underline">You likely just pay your deductible.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-fg-inv-dim">
            PowerEdge is DFW&apos;s insurance-first storm restoration team. We
            document the damage, coordinate with your adjuster by the book, and
            can{" "}
            <strong className="text-fg-inv">finance your deductible</strong> — so
            a sound new roof doesn&apos;t wait on cash up front.
          </p>

          {/* Conversion pillars — storm-first, financing, solar-ready */}
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-t border-line pt-6">
            {[
              { t: "Free storm inspection", d: "Documented for your claim" },
              { t: "Deductible financing", d: "$0 down to get started" },
              { t: "Solar + roof, one license", d: "Most roofers can't" },
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

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button href="#quote">Book my free inspection</Button>
            <Button href="/storm-check" variant="ghost">
              Check your address for hail →
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-fg-inv-dim">
            <span className="inline-flex items-center gap-2">
              <Stars />
              <strong className="text-fg-inv">{site.googleRating}</strong> (
              {site.googleReviewCount} reviews)
            </span>
            <span className="h-4 w-px bg-line" />
            <span>
              <strong className="text-fg-inv">TECL #{site.teclLicense}</strong>
            </span>
            <span className="h-4 w-px bg-line" />
            <span>
              <strong className="text-fg-inv">40-year</strong> master
              electrician
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
              Book your free storm inspection
            </h2>
            <p className="mt-1.5 text-sm text-fg-inv-dim">
              Hail or wind damage? We&apos;ll inspect it free, document it for
              your claim, and give you a straight answer — fast.
            </p>
            <div className="mt-6">
              <LeadForm compact defaultService="Storm / insurance claim" />
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
    { big: `#${site.teclLicense}`, small: "TX license you can verify (TECL)" },
    {
      big: `${site.capacity.crews} crews`,
      small: `~${site.capacity.roofsPerMonth} roofs / month capacity`,
    },
    {
      big: `${site.googleRating}★`,
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
      h: "We're licensed where it counts",
      p: `TECL #${site.teclLicense}, backed by John Lott's 40-year Master Electrician license. Look us up on the state's public TDLR portal before you ever sign.`,
    },
    {
      h: "Two trades, one accountable team",
      p: "Roof and electrical handled in-house — no subcontractor finger-pointing when your roof penetration meets your wiring.",
    },
    {
      h: "Built to show up, not just sign you up",
      p: "Four crews and 15 electricians mean we have the capacity to actually be there this week — not in a month.",
    },
  ];
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            kicker="Why PowerEdge"
            title="The one contractor you can actually verify."
            intro="Texas doesn't license roofers. Anyone with a ladder and a magnet sign can knock your door after a storm. But electrical and solar work legally require a Master Electrician's license — and that's exactly what we're built on."
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
            Check our license yourself.
          </p>
          <p className="mt-3 text-fg-inv-dim">
            The Texas Department of Licensing & Regulation keeps a free public
            record of every licensed electrical contractor — including status
            and any complaints.
          </p>
          <div className="mt-6 rounded-md border border-line bg-ink-2 p-5">
            <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
              Our license
            </div>
            <div className="mt-1 font-display text-3xl font-extrabold text-bolt">
              TECL #{site.teclLicense}
            </div>
          </div>
          <a
            href={site.tdlrVerifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 font-display font-bold text-bolt hover:text-bolt-hi"
          >
            Verify at TDLR.texas.gov →
          </a>
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
          title="Roofing, solar, and commercial — one licensed team."
          intro="Storm restoration and roof replacement for homes, solar detach & reset under our electrical license, and full roofing + electrical for commercial properties. Free inspections, no runaround."
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

/* ---------------------------------------------------- ROOF ESTIMATE BAND */
function RoofEstimateBand() {
  return (
    <section className="bg-ink py-20 sm:py-28">
      <Container>
        <div className="overflow-hidden rounded-card border border-bolt/30 bg-gradient-to-br from-ink-2 to-ink shadow-xl">
          <div className="grid lg:grid-cols-2">
            <div className="p-9 sm:p-12">
              <Kicker className="mb-5">Instant roof estimate</Kicker>
              <h2 className="font-display text-3xl font-bold leading-tight text-fg-inv sm:text-4xl">
                What does a new roof actually cost? See it in seconds.
              </h2>
              <p className="mt-4 text-fg-inv-dim">
                Most roofers won&apos;t tell you until a salesperson is in your
                living room. Enter your address — we measure your roof from
                aerial data and hand you an honest ballpark on the spot. If
                it&apos;s a storm claim, you likely just pay your deductible.
              </p>
              <div className="mt-7">
                <Button href="/roof-estimate">Estimate my roof →</Button>
              </div>
            </div>
            <div className="relative hidden border-l border-line bg-ink-2 p-12 lg:flex lg:items-center">
              <div className="w-full rounded-card border border-line bg-ink p-6">
                <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
                  123 Oak St, Plano TX
                </div>
                <div className="mt-2 font-display text-3xl font-extrabold text-fg-inv">
                  Estimated:{" "}
                  <span className="text-bolt">$13,500–$16,750</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-line p-3">
                    <div className="font-display text-xl font-extrabold text-bolt">
                      ~31–37
                    </div>
                    <div className="text-[11px] text-fg-inv-dim">
                      Roofing squares
                    </div>
                  </div>
                  <div className="rounded-md border border-line p-3">
                    <div className="font-display text-xl font-extrabold text-bolt">
                      2,650 ft²
                    </div>
                    <div className="text-[11px] text-fg-inv-dim">
                      Measured footprint
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------- ROOF CHECK BAND */
function RoofCheckBand() {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <div className="overflow-hidden rounded-card border border-paper-2 bg-ink shadow-xl">
          <div className="grid lg:grid-cols-2">
            <div className="p-9 sm:p-12">
              <Kicker className="mb-5">Free 60-second check</Kicker>
              <h2 className="font-display text-3xl font-bold leading-tight text-fg-inv sm:text-4xl">
                Is your roof still on full replacement coverage?
              </h2>
              <p className="mt-4 text-fg-inv-dim">
                Texas insurers quietly downgrade aging roofs to
                actual-cash-value — so a claim can pay thousands less than a new
                roof actually costs. Find out where you stand in five quick
                questions. No phone call required.
              </p>
              <div className="mt-7">
                <Button href="/roof-check">Take the free roof check →</Button>
              </div>
              <p className="mt-4 text-xs text-fg-inv-dim">
                Honest read, no pressure. We&apos;ll tell you straight if
                you&apos;re fine.
              </p>
            </div>

            {/* Mini interaction preview */}
            <div className="relative hidden border-l border-line bg-ink-2 p-12 lg:flex lg:items-center">
              <div className="w-full rounded-card border border-line bg-ink p-6">
                <div className="kicker text-bolt">Step 1 of 5</div>
                <div className="mt-3 h-1 w-full rounded-full bg-line">
                  <div className="h-1 w-1/5 rounded-full bg-bolt" />
                </div>
                <p className="mt-5 font-display text-xl font-bold text-fg-inv">
                  How old is your roof?
                </p>
                <div className="mt-4 space-y-2.5">
                  {["0–9 years", "10–15 years", "16–20 years", "20+ years"].map(
                    (o, idx) => (
                      <div
                        key={o}
                        className={`flex items-center justify-between rounded-md border px-4 py-3 text-sm ${
                          idx === 2
                            ? "border-bolt bg-bolt/10 text-fg-inv"
                            : "border-line text-fg-inv-dim"
                        }`}
                      >
                        {o}
                        {idx === 2 && <span className="text-bolt">→</span>}
                      </div>
                    ),
                  )}
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
            <Button href="/storm-check">Check your address for hail →</Button>
          </div>
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
    "Solar detach & reset not covered on the claim",
  ];
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            kicker="Stuck on the out-of-pocket?"
            title="Approved for a roof but can't cover the deductible? You're not stuck."
            intro="In Texas, a wind/hail deductible is often 1–2% of your home's value — $5,000–$10,000 out of pocket before work even starts. If that's the wall between you and a sound roof, we finance it: $0 down, low monthly payments, and we get the job scheduled now. Already have an estimate from another roofer? Bring it — we'll do the work and finance it."
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

/* -------------------------------------------------------- SOLAR-READY BAND */
function SolarReadyBand() {
  return (
    <section className="bg-paper py-16 sm:py-20">
      <Container>
        <div className="overflow-hidden rounded-card border-2 border-bolt/40 bg-ink shadow-xl">
          <div className="grid items-center gap-8 p-9 sm:p-12 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <Kicker className="mb-4">Got solar panels?</Kicker>
              <h2 className="font-display text-3xl font-bold leading-tight text-fg-inv sm:text-4xl">
                Solar on your roof? We&apos;re one of the few who can legally do
                the whole job.
              </h2>
              <p className="mt-4 text-fg-inv-dim">
                Replacing a roof with solar means the panels have to come off and
                go back on — and in Texas that&apos;s electrical work most roofers
                can&apos;t legally touch. They sub it out, and you&apos;re left
                juggling two companies with your roof sitting exposed. We detach,
                re-roof, and reset your panels in-house, on one schedule, under
                one license — and the detach &amp; reset is usually a covered line
                item on your claim.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button href="#quote">Book my free inspection</Button>
                <Button href="/solar" variant="ghost">
                  How solar + roof works →
                </Button>
              </div>
            </div>
            <div className="rounded-card border border-line bg-ink-2 p-7 text-center">
              <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
                One licensed team
              </div>
              <div className="mt-2 font-display text-3xl font-extrabold text-bolt">
                Roof + Solar
              </div>
              <div className="mt-3 text-sm leading-relaxed text-fg-inv-dim">
                Detach · re-roof · reset · re-energize — no finger-pointing, one
                warranty.
              </div>
              <div className="mt-4 border-t border-line pt-4 text-sm text-fg-inv-dim">
                Performed under{" "}
                <span className="font-bold text-fg-inv">
                  TECL #{site.teclLicense}
                </span>
              </div>
            </div>
          </div>
        </div>
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
            Free roof inspection, up-front electrical pricing, and a real person
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
