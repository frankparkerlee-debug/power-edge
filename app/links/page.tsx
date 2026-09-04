import type { Metadata } from "next";
import { site } from "@/lib/site";

// Link-in-bio page for Instagram/social — our own "Linktree," on-brand and
// UTM-tracked. Noindexed: it's a social routing page, not a search surface.
export const metadata: Metadata = {
  title: "PowerEdge — Links",
  robots: { index: false, follow: false },
};

const UTM = "utm_source=instagram&utm_medium=social&utm_campaign=bio";

const links = [
  {
    label: "Do I have a roof claim? — free 60-sec check",
    sub: "Check your address against NWS storm records",
    href: `/roof-claim-check?${UTM}`,
    primary: true,
  },
  {
    label: "Can't front your deductible? Start for $250 down",
    sub: "See your monthly payment in seconds",
    href: `/financing?${UTM}`,
    primary: true,
  },
  {
    label: "Book a free roof inspection",
    sub: "Documented for your claim · verdict in writing",
    href: `/free-inspection?${UTM}`,
    primary: false,
  },
  {
    label: "We're hiring roofing sales reps",
    sub: "Paid at first check · 60-second apply",
    href: `/careers?${UTM}`,
    primary: false,
  },
];

export default function LinksPage() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-ink py-14">
      <div className="absolute inset-0 grid-texture opacity-40" />
      <div className="relative mx-auto w-full max-w-md px-5">
        <p className="text-center font-display text-4xl font-extrabold">
          <span className="text-fg-inv">power</span>
          <span className="text-bolt">edge</span>
        </p>
        <p className="mt-2 text-center text-sm uppercase tracking-wider text-fg-inv-dim">
          Roofing &amp; storm restoration · DFW
        </p>
        <p className="mt-3 text-center text-sm text-fg-inv-dim">
          Licensed &amp; insured ·{" "}
          {site.googleRating}★
        </p>

        <div className="mt-8 space-y-3">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`block rounded-card border p-5 text-center transition-colors ${
                l.primary
                  ? "border-bolt bg-bolt/10 hover:bg-bolt/20"
                  : "border-line bg-ink-2 hover:border-bolt"
              }`}
            >
              <span
                className={`font-display text-lg font-bold ${
                  l.primary ? "text-bolt" : "text-fg-inv"
                }`}
              >
                {l.label}
              </span>
              <span className="mt-0.5 block text-sm text-fg-inv-dim">
                {l.sub}
              </span>
            </a>
          ))}

          <a
            href={site.phoneHref}
            className="block rounded-card bg-bolt p-5 text-center font-display text-lg font-extrabold text-ink transition-colors hover:bg-bolt-hi"
          >
            Call or text {site.phone}
          </a>
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-fg-inv-dim">
          We never waive deductibles or pose as your adjuster — that&apos;s the
          law, and it protects you. If your roof is fine, we&apos;ll tell you in
          writing.
        </p>
      </div>
    </section>
  );
}
