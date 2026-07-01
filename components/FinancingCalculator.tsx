"use client";

import { useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";

/**
 * Deductible / project financing calculator — reflects PowerEdge's two IN-HOUSE
 * (self-funded) payment plans:
 *   • Pay-in-4  — 4 monthly payments, 0% interest
 *   • 12-month  — 12 monthly payments, 12.99% APR
 *
 * COMPLIANCE: illustrative estimate only, NOT a financing offer. The homeowner
 * always pays their full deductible over time — we never waive it (illegal in
 * Texas, HB 2102 / §27.02). The 12-month interest-bearing plan is consumer
 * credit: final terms + TILA disclosures are provided in writing before signing,
 * and the program itself requires counsel/licensing review before it runs.
 */

const RATE_12 = 0.1299; // 12-month plan APR

const PRESETS = [1000, 2500, 5000, 8000, 10000, 15000];

function amortized(principal: number, annualRate: number, n: number) {
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

  const pay4 = amount > 0 ? amount / 4 : 0;
  const pay12 = amount > 0 ? amortized(amount, RATE_12, 12) : 0;

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

      {/* Two in-house plans, side by side */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-line bg-ink p-4 text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-fg-inv-dim">
            Pay in 4
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold text-fg-inv sm:text-3xl">
            {usd(pay4)}
            <span className="text-sm font-bold text-fg-inv-dim">/mo</span>
          </div>
          <div className="mt-1 text-xs text-fg-inv-dim">
            4 payments · <span className="text-bolt">0% interest</span>
          </div>
        </div>
        <div className="rounded-md border border-bolt/40 bg-bolt/5 p-4 text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-fg-inv-dim">
            12-month plan
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold text-bolt sm:text-3xl">
            {usd(pay12)}
            <span className="text-sm font-bold text-fg-inv-dim">/mo</span>
          </div>
          <div className="mt-1 text-xs text-fg-inv-dim">
            12 payments · 12.99% APR
          </div>
        </div>
      </div>

      <Link
        href={ctaHref}
        onClick={() =>
          track("financing_calc_cta", { amount: String(amount) })
        }
        className="mt-4 block w-full rounded-md bg-bolt px-6 py-4 text-center font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi"
      >
        Get financed &amp; scheduled →
      </Link>

      <p className="mt-3 text-xs leading-relaxed text-fg-inv-dim">
        Illustrative estimate only — not a financing offer. Plans are in-house
        and subject to approval; final terms and required disclosures are
        provided in writing before you sign. You pay your full deductible over
        time; we never waive it (that&apos;s illegal in Texas).
      </p>
    </div>
  );
}
