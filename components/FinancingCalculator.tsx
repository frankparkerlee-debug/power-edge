"use client";

import { useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";

/**
 * Deductible / project financing calculator for PowerEdge's two IN-HOUSE
 * (self-funded) payment plans. Parker, 2026-11-09: NO INTEREST on any plan.
 *   • Pay-in-4, 4 monthly payments, 0%
 *   • 12-month, 0%
 *
 * This used to compute the 12-month payment from a hidden 12.99% rate while
 * labelling it "rate set by credit". On an $8,000 deductible that quoted about
 * $714/mo against a true $667, so the site was advertising a worse deal than
 * the business actually gives, and the rate behind the number was never shown.
 * Both plans are now a straight division.
 *
 * COMPLIANCE: illustrative estimate only, NOT a financing offer. The homeowner
 * always pays their full deductible over time; we never waive it (illegal in
 * Texas, HB 2102 / §27.02). Because no finance charge is added, these plans
 * are not interest-bearing consumer credit, which is also what keeps them
 * outside the Texas Finance Code Ch. 345 registration that applies to retail
 * installment sales WITH a finance charge. If an interest-bearing plan is ever
 * introduced, that registration question comes straight back.
 */

const PRESETS = [1000, 2500, 5000, 8000, 10000, 15000];

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
  const [plan, setPlan] = useState<"pay4" | "m12">("m12");

  const pay4 = amount > 0 ? amount / 4 : 0;
  const pay12 = amount > 0 ? amount / 12 : 0;

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

      {/* Two in-house plans, tap to choose */}
      <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-fg-inv-dim">
        Choose a plan
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setPlan("pay4")}
          aria-pressed={plan === "pay4"}
          className={`rounded-md border p-4 text-center transition-colors ${
            plan === "pay4"
              ? "border-2 border-bolt bg-bolt/10"
              : "border border-line bg-ink hover:border-bolt"
          }`}
        >
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
        </button>
        <button
          type="button"
          onClick={() => setPlan("m12")}
          aria-pressed={plan === "m12"}
          className={`rounded-md border p-4 text-center transition-colors ${
            plan === "m12"
              ? "border-2 border-bolt bg-bolt/10"
              : "border border-line bg-ink hover:border-bolt"
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-fg-inv-dim">
            12-month plan
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold text-bolt sm:text-3xl">
            {usd(pay12)}
            <span className="text-sm font-bold text-fg-inv-dim">/mo</span>
          </div>
          <div className="mt-1 text-xs text-fg-inv-dim">
            12 payments · <span className="text-bolt">0% interest</span>
          </div>
        </button>
      </div>

      <Link
        href={ctaHref}
        onClick={() =>
          track("financing_calc_cta", {
            amount: String(amount),
            plan,
          })
        }
        className="mt-4 block w-full rounded-md bg-bolt px-6 py-4 text-center font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi"
      >
        Get pre-qualified · {plan === "pay4" ? "Pay in 4" : "12-month"} →
      </Link>

      <p className="mt-3 text-xs leading-relaxed text-fg-inv-dim">
        Illustrative estimate only, not a financing offer. Plans are in-house
        and subject to approval; final terms and required disclosures are
        provided in writing before you sign. You pay your full deductible over
        time; we never waive it (that&apos;s illegal in Texas).
      </p>
    </div>
  );
}
