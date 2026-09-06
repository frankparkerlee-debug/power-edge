import { Button, Container, Kicker } from "./ui";
import { LeadForm } from "./LeadForm";
import { site } from "@/lib/site";

/** Dark page hero used on interior pages. Pass `withForm` to render an
 *  above-the-fold quote form (fast capture on service landing pages). */
export function PageHero({
  kicker,
  title,
  intro,
  badge,
  badgeHref = "#quote",
  withForm = false,
}: {
  kicker: string;
  title: string;
  intro: string;
  badge?: string;
  badgeHref?: string;
  withForm?: boolean;
}) {
  const left = (
    <div>
      <Kicker className="mb-5">{kicker}</Kicker>
      <h1 className="max-w-3xl font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl md:text-6xl">
        {title}
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-fg-inv-dim">
        {intro}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button href={badgeHref}>{badge ?? "Get a free quote"}</Button>
        <Button href={site.phoneHref} variant="ghost">
          Call {site.phone}
        </Button>
      </div>
    </div>
  );

  return (
    <section className="relative overflow-hidden bg-ink">
      <div className="absolute inset-0 grid-texture opacity-60" />
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-bolt/15 blur-[120px]" />
      <Container className="relative py-16 sm:py-20">
        {withForm ? (
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            {left}
            <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-7">
              <h2 className="font-display text-xl font-bold text-fg-inv">
                Get your free quote
              </h2>
              <p className="mt-1 text-sm text-fg-inv-dim">
                A real person calls you back fast — usually within the hour.
              </p>
              <div className="mt-5">
                <LeadForm compact />
              </div>
            </div>
          </div>
        ) : (
          left
        )}
      </Container>
    </section>
  );
}

/** Bottom-of-page lead capture band, reused across interior pages. */
export function CtaBand({
  heading = "Tell us what's going on.",
  sub = "Free roof inspection, upfront pricing, and a real person on the phone.",
}: {
  heading?: string;
  sub?: string;
}) {
  return (
    <section id="quote" className="scroll-mt-20 bg-paper py-20 sm:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-extrabold leading-tight text-fg sm:text-4xl">
            {heading}
          </h2>
          <p className="mt-4 max-w-md text-lg text-fg-dim">{sub}</p>
          <div className="mt-6">
            <a
              href={site.phoneHref}
              className="font-display text-2xl font-extrabold text-fg"
            >
              {site.phone}
            </a>
            <p className="mt-1 text-sm text-fg-dim">
              Insured & accountable ·{" "}
              {site.liabilityCoverage} coverage
            </p>
          </div>
        </div>
        <div className="rounded-card bg-ink p-7 shadow-2xl">
          <LeadForm />
        </div>
      </Container>
    </section>
  );
}

/** Simple feature list for interior pages (on light background). */
export function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((b) => (
        <li
          key={b}
          className="flex gap-3 rounded-card border border-paper-2 bg-white p-5 shadow-sm"
        >
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bolt">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-ink">
              <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
            </svg>
          </span>
          <span className="text-fg">{b}</span>
        </li>
      ))}
    </ul>
  );
}
