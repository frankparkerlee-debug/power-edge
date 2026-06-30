import Link from "next/link";

/**
 * Deductible-financing selling point. COMPLIANT framing (verified against Texas
 * HB 2102 / Bus. & Comm. Code §27.02): financing a deductible is legal because
 * the homeowner pays it IN FULL over time. We must never imply we waive, pay,
 * absorb, rebate, or reduce the deductible — so the copy explicitly says the
 * homeowner pays their full deductible, and calls out that waiving is illegal.
 *
 * NOTE(parker): this presents financing as available — make sure a real
 * lender/payment-plan program is in place to back it.
 */
export function DeductibleFinancing({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-card border-2 border-bolt bg-bolt/10 p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bolt">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-ink" aria-hidden>
            <path d="M3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3H3V6zm0 5h18v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7zm3 4h5v2H6v-2z" />
          </svg>
        </span>
        <div>
          <p className="font-display text-lg font-bold text-fg-inv">
            Finance your deductible — $0 down.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-fg-inv-dim">
            Short on cash for your deductible? Spread it into low monthly
            payments and get your roof replaced now. You still pay your full
            deductible over time — we never waive it (that&apos;s illegal in
            Texas, and following the law protects you).
          </p>
          <Link
            href="/guides/roof-deductible-financing-texas"
            className="mt-2 inline-block font-display text-sm font-bold text-bolt hover:text-bolt-hi"
          >
            See how deductible financing works →
          </Link>
        </div>
      </div>
    </div>
  );
}
