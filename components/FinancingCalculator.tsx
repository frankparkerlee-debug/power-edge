"use client";

import { useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";

/**
 * Deductible / project financing calculator.
 *
 * COMPLIANCE: this shows an ILLUSTRATIVE monthly-payment RANGE only — never a
 * financing offer or a guaranteed rate. The APR band below is representative of
 * typical home-improvement financing, NOT a quoted rate; swap in the real
 * lender's terms once a program is in place (see NOTE(parker) in
 * DeductibleFinancing). The homeowner always pays their full deductible over
 * time — we never waive it (illegal in Texas, HB 2102 / §27.02).
 */

// Representative APR band for illustration only — replace with lender terms.
const APR_LOW = 0.0999;
const APR_HIGH = 0.1799;

const PRESETS = [1000, 2500, 5000, 8000, 10000, 15000];
const TERMS = [
  { months: 36, label: "3 yr" },
  { months: 60, label: "5 yr" },
  { months: 120, label: "10 yr" },
];

function monthly(principal: number, annualRate: number, n: number) {
  const r = annualRate / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export function FinancingCalculator({
  ctaHref = "#quote",
  className = "",
}: {
  ctaHref?: string;
  className?: string;
}) {
  const [amount, setAmount] = useState(8000);
  const [term, setTerm] = useState(60);

  const low = amount > 0 ? monthly(amount, APR_LOW, term) : 0;
  const high = amount > 0 ? monthly(amount, APR_HIGH, term) : 0;

  return (
    <div
      className={`rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8 ${className}`}
    >
      <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
        Your deductible or out-of-pocket
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
              amount === p
                ? "border-bolt bg-bolt/10 text-bolt"
                : "border-line text-fg-inv-dim hover:border-bolt"
            }`}
          >
            {usd(p)}
          </button>
        ))}
      </div>

      <label className="mt-3 block text-sm text-fg-inv-dim">
        Or enter an amount
        <input
          type="number"
          min={0}
          step={500}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          className="mt-1 w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv focus:border-bolt focus:outline-none"
        />
      </label>

      <div className="mt-4">
        <div className="text-sm text-fg-inv-dim">Spread it over</div>
        <div className="mt-1 flex gap-2">
          {TERMS.map((t) => (
            <button
              key={t.months}
              type="button"
              onClick={() => setTerm(t.months)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                term === t.months
                  ? "border-bolt bg-bolt/10 text-bolt"
                  : "border-line text-fg-inv-dim hover:border-bolt"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-md border border-bolt/40 bg-bolt/5 p-5 text-center">
        <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
          Estimated monthly payment
        </div>
        <div className="mt-1 font-display text-4xl font-extrabold text-bolt">
          {usd(low)}–{usd(high)}
          <span className="text-lg font-bold text-fg-inv-dim">/mo</span>
        </div>
        <div className="mt-1 text-sm text-fg-inv-dim">
          on {usd(amount)} over {term / 12} years
        </div>
      </div>

      <Link
        href={ctaHref}
        onClick={() =>
          track("financing_calc_cta", {
            amount: String(amount),
            term: String(term),
          })
        }
        className="mt-4 block w-full rounded-md bg-bolt px-6 py-4 text-center font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi"
      >
        Get financed &amp; scheduled →
      </Link>

      <p className="mt-3 text-xs leading-relaxed text-fg-inv-dim">
        Illustrative example only — not a financing offer or a guarantee of
        terms. Your actual rate, term, and payment depend on the lender and your
        credit approval. You pay your full deductible over time; we never waive
        it (that&apos;s illegal in Texas).
      </p>
    </div>
  );
}
