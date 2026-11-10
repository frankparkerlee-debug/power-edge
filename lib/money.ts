/**
 * Money, written the way money is written.
 *
 * Prices are stored as free text because a rep types them and a carrier's
 * settlement is whatever it is. That meant "20000" reached a homeowner's
 * agreement exactly as typed, next to a deductible of "5000", and the person
 * being asked to sign had to work out what any of it meant. On a document
 * someone is committing twenty thousand dollars to, that is not a formatting
 * nicety.
 */

/** "20000", "$22,530", 20000 -> 20000. Anything unparseable -> 0. */
export function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** 20000 -> "$20,000.00". Empty input gives an empty string, not "$0.00". */
export function money(v: unknown): string {
  if (v === null || v === undefined || String(v).trim() === "") return "";
  return toNumber(v).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Same, without the cents, for places where they only add noise. */
export function moneyShort(v: unknown): string {
  if (v === null || v === undefined || String(v).trim() === "") return "";
  return toNumber(v).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/**
 * Who pays what on an insurance job.
 *
 * The homeowner's actual question is "what does this cost me", and the answer
 * is the deductible, not the contract total. Texas law requires them to pay
 * it and requires us to say so, so the one number they owe should be the one
 * number that is impossible to miss.
 */
export function claimSplit(total: unknown, deductible: unknown) {
  const t = toNumber(total);
  const d = toNumber(deductible);
  const hasBoth = t > 0 && d > 0;
  // A deductible larger than the settlement means the figures disagree; show
  // what we have rather than a negative carrier payment.
  const carrier = hasBoth ? Math.max(t - d, 0) : 0;
  return {
    total: t,
    deductible: d,
    carrier,
    /** Only show a split when both halves are real. */
    show: hasBoth,
    totalText: money(t),
    deductibleText: money(d),
    carrierText: money(carrier),
  };
}
