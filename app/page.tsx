import Link from "next/link";
import { Button, Container, Kicker, SectionHeading, Stars } from "@/components/ui";
import { LeadForm } from "@/components/LeadForm";
import { Reviews } from "@/components/Reviews";
import { Gallery } from "@/components/Gallery";
import { site } from "@/lib/site";
import { services, electricalMenu } from "@/lib/services";
import { cities } from "@/lib/cities";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Wedge />
      <ServicesGrid />
      <RoofCheckBand />
      <PricingTeaser />
      <StormBand />
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
            Roofing + Electrical · Dallas–Fort Worth
          </Kicker>
          <h1 className="font-display text-[2.7rem] leading-[0.95] text-fg-inv sm:text-6xl md:text-[4.2rem]">
            Two trades.
            <br />
            <span className="bolt-underline">One license you can check.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-fg-inv-dim">
            Roofing and electrical from a single licensed Texas crew — so
            there&apos;s no finger-pointing, and no wondering whether the people
            on your roof are the real deal.
          </p>

          {/* Crossover pillars — make the two-trades-plus-solar scope explicit */}
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-t border-line pt-6">
            {[
              { t: "Roofing", d: "Repair & replacement" },
              { t: "Electrical", d: "Service & panels" },
              { t: "Solar", d: "Repair & replacement" },
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
            <Button href="#quote">Get a free inspection</Button>
            <Button href={site.phoneHref} variant="ghost">
              Call {site.phone}
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
              Get your free quote
            </h2>
            <p className="mt-1.5 text-sm text-fg-inv-dim">
              Free roof inspections. Up-front electrical pricing. A real person
              calls you back fast.
            </p>
            <div className="mt-6">
              <LeadForm compact />
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
    { big: `#${site.teclLicense}`, small: "TX electrical license (TECL)" },
    {
      big: `${site.capacity.crews} crews`,
      small: `~${site.capacity.roofsPerMonth} roofs / month capacity`,
    },
    { big: `${site.capacity.electricians}`, small: "electricians on staff" },
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
          title="Two trades. One license. No runaround."
          intro="Residential and commercial. Transparent pricing where it makes sense, free inspections where it counts."
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

/* -------------------------------------------------------- PRICING TEASER */
function PricingTeaser() {
  const sample = electricalMenu[0].items
    .concat(electricalMenu[1].items.slice(1, 2))
    .slice(0, 4);
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <SectionHeading
          kicker="Pricing you can see"
          title="We publish our electrical prices. Most won't."
          intro="No mystery invoices. Common electrical jobs are priced up front so you can compare before anyone steps inside. Roofing stays free-inspection because honest roof pricing depends on what we actually find up there."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sample.map((item) => (
            <div
              key={item.job}
              className="rounded-card border border-paper-2 bg-white p-6 shadow-sm"
            >
              <div className="font-display text-2xl font-extrabold text-fg">
                {item.price}
              </div>
              <div className="mt-2 font-semibold text-fg">{item.job}</div>
              <p className="mt-1 text-sm text-fg-dim">{item.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <Button href="/electrical" variant="dark">
            See the full electrical price list
          </Button>
        </div>
      </Container>
    </section>
  );
}

/* ----------------------------------------------------------- STORM BAND */
function StormBand() {
  return (
    <section className="relative overflow-hidden bg-ink py-16">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-ember" />
      <Container className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <p className="kicker text-ember">Storm & hail damage</p>
          <h2 className="mt-4 font-display text-3xl font-bold text-fg-inv sm:text-4xl">
            Hail hit? We handle Texas insurance claims by the book.
          </h2>
          <p className="mt-4 text-fg-inv-dim">
            We document the damage, work directly with your adjuster, and never
            play the games that get homeowners in trouble — no waiving your
            deductible, no pretending to be your public adjuster. Just an honest
            claim and a roof done right.
          </p>
        </div>
        <Button href="/storm-check">Check your address for hail →</Button>
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
