import { site } from "@/lib/site";

/**
 * The named anti-storm-chaser promise — differentiation through verifiable
 * honesty, not urgency. Every claim in here is checkable or legally grounded:
 * that's the point. Used on the ad landing pages (claim check, free inspection)
 * where cold traffic is most wary of roofer games.
 */
export function HonestyStandard({ className = "" }: { className?: string }) {
  const commitments = [
    {
      h: "We'll tell you if your roof is fine",
      p: "No manufactured damage, no scare inspections. If there's nothing worth claiming, you'll hear exactly that — in writing.",
    },
    {
      h: "We never touch your deductible",
      p: "Waiving or \"eating\" deductibles is a crime in Texas. Any roofer who offers is breaking the law with your name on the contract.",
    },
    {
      h: "We never pose as your adjuster",
      p: "We document the damage and coordinate with your adjuster — we don't \"handle your claim.\" That line is the law, and it protects you.",
    },
    {
      h: "A real, accountable company",
      p: `Texas doesn't license roofers, so anyone can claim to be one. We're a licensed, insured company with $2,000,000 in liability coverage and a 1-year workmanship guarantee — not a magnet sign on a truck.`,
    },
  ];
  return (
    <section className={`bg-ink py-16 sm:py-20 ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <p className="kicker text-bolt">The PowerEdge standard</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-tight text-fg-inv sm:text-4xl">
          Every storm brings out the storm-chasers. We're built to be the
          opposite.
        </h2>
        <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {commitments.map((c) => (
            <div key={c.h} className="flex gap-3.5">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bolt">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-ink">
                  <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
                </svg>
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-fg-inv">
                  {c.h}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-fg-inv-dim">
                  {c.p}
                </p>
              </div>
            </div>
          ))}
        </div>
        <a
          href={site.phoneHref}
          className="mt-8 inline-block font-display font-bold text-bolt hover:text-bolt-hi"
        >
          Questions before you sign? Call or text us →
        </a>
      </div>
    </section>
  );
}
