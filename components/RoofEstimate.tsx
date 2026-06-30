"use client";

import { useState } from "react";
import { SmsConsent } from "./SmsConsent";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { RoofMap } from "./RoofMap";
import { DeductibleFinancing } from "./DeductibleFinancing";
import { leadContext } from "@/lib/leadContext";
import { track } from "@/lib/analytics";
import { site } from "@/lib/site";

/**
 * Instant roof estimate. Address → auto-measures the roof (OSM footprint) and
 * prices a range at the company's $/square; falls back to a quick square-footage
 * entry when a home isn't auto-measurable. Always a RANGE + "free exact
 * on-site measurement," and the insurance/deductible reality.
 */

type Est = {
  ok: boolean;
  source?: "satellite" | "measured" | "manual" | "need_manual";
  matched?: string | null;
  footprintSqft?: number;
  roofSqft?: number;
  pitchDeg?: number | null;
  squaresLow?: number;
  squaresHigh?: number;
  low?: number;
  high?: number;
  home?: { lat: number; lon: number } | null;
};

type Phase = "input" | "manual" | "result";
type Sub = "idle" | "submitting" | "done" | "error";

const usd = (n?: number) =>
  n == null ? "" : "$" + n.toLocaleString("en-US");

export function RoofEstimate() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("input");
  const [est, setEst] = useState<Est | null>(null);
  const [sub, setSub] = useState<Sub>("idle");
  const [intent, setIntent] = useState<"unknown" | "insurance" | "cash">(
    "unknown",
  );
  const [deductible, setDeductible] = useState("");

  async function run(payload: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch("/api/roof-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as Est;
      setEst(data);
      if (data.source === "need_manual") setPhase("manual");
      else setPhase("result");
    } catch {
      setPhase("manual");
    } finally {
      setLoading(false);
    }
  }

  async function submitLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSub("submitting");
    const form = e.currentTarget;
    const fd = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const range =
      est?.low && est?.high ? `${usd(est.low)}–${usd(est.high)}` : "n/a";
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.name,
          phone: fd.phone,
          email: fd.email,
          zip: fd.zip,
          service:
            intent === "insurance"
              ? "Storm/insurance roof (deductible)"
              : "Roof replacement estimate",
          message: `[Roof Estimate] ${est?.matched || address} — ~${est?.squaresLow}-${est?.squaresHigh} squares (${est?.source})${intent === "insurance" ? ` — INSURANCE claim, deductible: ${deductible || "unknown"}` : `, est ${range}`}`,
          company_website: fd.company_website,
          ...leadContext({ tool: "roof-estimate" }),
        }),
      });
      if (!res.ok) throw new Error();
      track("lead_submit", { form: "roof_estimate" });
      setSub("done");
      form.reset();
    } catch {
      setSub("error");
    }
  }

  const inputBase =
    "w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";

  return (
    <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
      {/* Address input */}
      {phase === "input" && (
        <>
          <h2 className="font-display text-2xl font-bold text-fg-inv">
            Estimate my roof
          </h2>
          <p className="mt-2 text-sm text-fg-inv-dim">
            Enter your address and we&apos;ll measure your roof from aerial data
            and give you a ballpark replacement price — instantly, no sales call.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (address.trim()) run({ address });
            }}
            className="mt-6 space-y-3"
          >
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              onSelect={(v) => run({ address: v })}
              className={inputBase}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
            >
              {loading ? "Measuring your roof…" : "Get my instant estimate"}
            </button>
          </form>
          <p className="mt-3 text-center text-xs text-fg-inv-dim">
            Ballpark only. Your exact price comes from a free on-site
            measurement.
          </p>
        </>
      )}

      {/* Manual fallback */}
      {phase === "manual" && (
        <>
          <h2 className="font-display text-2xl font-bold text-fg-inv">
            Quick estimate
          </h2>
          <p className="mt-2 text-sm text-fg-inv-dim">
            We couldn&apos;t auto-measure that address. Enter your home&apos;s
            size for an instant ballpark.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = Object.fromEntries(
                new FormData(e.currentTarget).entries(),
              ) as Record<string, string>;
              run({
                address: est?.matched || address,
                manualSqft: Number(fd.sqft),
                stories: Number(fd.stories || 1),
              });
            }}
            className="mt-6 space-y-3"
          >
            <input
              name="sqft"
              required
              type="number"
              placeholder="Home square footage (e.g. 2400)"
              className={inputBase}
              inputMode="numeric"
            />
            <select name="stories" defaultValue="1" className={inputBase}>
              <option value="1">1 story</option>
              <option value="2">2 stories</option>
              <option value="3">3 stories</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
            >
              {loading ? "Calculating…" : "Get my estimate"}
            </button>
          </form>
        </>
      )}

      {/* Result */}
      {phase === "result" && est && sub !== "done" && (
        <>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-bolt px-3 py-1 text-xs font-bold uppercase tracking-wider text-bolt">
            {est.source === "satellite"
              ? "Measured from satellite imagery"
              : est.source === "measured"
                ? "Measured from aerial data"
                : "Estimate"}
          </div>
          <h2 className="font-display text-2xl font-bold leading-tight text-fg-inv sm:text-3xl">
            {intent === "cash" ? (
              <>
                Estimated roof replacement:{" "}
                <span className="text-bolt">
                  {usd(est.low)}–{usd(est.high)}
                </span>
              </>
            ) : intent === "insurance" ? (
              "You likely pay just your deductible."
            ) : (
              "We measured your roof."
            )}
          </h2>
          {est.matched && (
            <p className="mt-2 text-sm text-fg-inv-dim">{est.matched}</p>
          )}

          {est.home && (
            <div className="mt-5 overflow-hidden rounded-card border border-line">
              <div className="h-52">
                <RoofMap home={est.home} />
              </div>
              <div className="bg-ink px-4 py-2 text-[11px] text-fg-inv-dim">
                Your roof, from above
                {est.source === "satellite" && est.pitchDeg
                  ? ` · measured pitch ~${est.pitchDeg}°`
                  : ""}
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Stat
              big={
                est.squaresLow === est.squaresHigh
                  ? `~${est.squaresLow}`
                  : `~${est.squaresLow}–${est.squaresHigh}`
              }
              small="Roofing squares (est.)"
            />
            <Stat
              big={`${(est.roofSqft ?? est.footprintSqft)?.toLocaleString()} ft²`}
              small={
                est.source === "satellite"
                  ? "Measured roof area"
                  : est.source === "measured"
                    ? "Measured footprint"
                    : "Footprint (from size)"
              }
            />
          </div>

          {/* Choose path — changes what we show and what they'd actually pay */}
          {intent === "unknown" && (
            <div className="mt-5 rounded-card border border-line bg-ink p-5">
              <p className="font-display text-lg font-bold text-fg-inv">
                Is this storm or hail damage you might file on insurance?
              </p>
              <p className="mt-1 text-sm text-fg-inv-dim">
                It changes what you&apos;d actually pay out of pocket.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIntent("insurance")}
                  className="rounded-md bg-bolt px-5 py-4 font-display font-bold text-ink transition-colors hover:bg-bolt-hi"
                >
                  Yes — likely a claim
                </button>
                <button
                  type="button"
                  onClick={() => setIntent("cash")}
                  className="rounded-md border border-line px-5 py-4 font-display font-bold text-fg-inv transition-colors hover:border-bolt hover:text-bolt"
                >
                  No — paying myself
                </button>
              </div>
            </div>
          )}

          {/* INSURANCE — no retail price; deductible + financing */}
          {intent === "insurance" && (
            <>
              <div className="mt-5 rounded-card border border-bolt/40 bg-bolt/5 p-5">
                <p className="text-sm leading-relaxed text-fg-inv">
                  If your roof qualifies, your out-of-pocket is just your{" "}
                  <strong className="text-bolt">deductible</strong> — insurance
                  covers the rest of the replacement. We&apos;ve already measured
                  your roof, so we know the scope when we work with your adjuster.
                </p>
                <label className="mt-4 block text-sm text-fg-inv-dim">
                  Your wind/hail deductible (optional)
                  <select
                    value={deductible}
                    onChange={(e) => setDeductible(e.target.value)}
                    className={`mt-1 ${inputBase}`}
                  >
                    <option value="">Select…</option>
                    <option value="$500">$500</option>
                    <option value="$1,000">$1,000</option>
                    <option value="$2,500">$2,500</option>
                    <option value="$5,000">$5,000</option>
                    <option value="1% of home value">1% of home value</option>
                    <option value="unsure">Not sure</option>
                  </select>
                </label>
                {deductible && deductible !== "unsure" && (
                  <p className="mt-3 font-display text-lg font-bold text-fg-inv">
                    Your estimated out-of-pocket:{" "}
                    <span className="text-bolt">{deductible}</span>
                  </p>
                )}
              </div>

              <DeductibleFinancing className="mt-4" />

              <p className="mt-4 text-sm leading-relaxed text-fg-inv-dim">
                We document the damage, work directly with your adjuster, and
                handle the entire claim by the book.
              </p>
            </>
          )}

          {/* CASH — show the retail estimate */}
          {intent === "cash" && (
            <>
              <p className="mt-4 text-sm leading-relaxed text-fg-inv-dim">
                Based on architectural asphalt shingles at our standard rate.
                Steeper pitch, premium materials, or extra tear-off can change it
                — your{" "}
                <strong className="text-fg-inv">exact price is free and on-site.</strong>
              </p>
              <details className="mt-3 text-sm text-fg-inv-dim">
                <summary className="cursor-pointer font-semibold text-bolt">
                  How we calculated this
                </summary>
                <p className="mt-2 leading-relaxed">
                  {est.source === "satellite"
                    ? `We measured your roof's surface area (~${(est.roofSqft ?? 0).toLocaleString()} sq ft) from satellite imagery, divided by 100 to get roofing "squares," added ~10% for waste and cuts, and priced at $400–$450 per square installed.`
                    : est.source === "measured"
                      ? `We measured your building footprint (~${(est.footprintSqft ?? 0).toLocaleString()} sq ft) from aerial map data, applied a typical roof pitch and ~10% waste to estimate ${est.squaresLow}–${est.squaresHigh} squares, and priced at $400–$450 per square installed.`
                      : `We used the home size you entered to estimate a roof footprint, applied a typical pitch and ~10% waste to get ${est.squaresLow}–${est.squaresHigh} squares, and priced at $400–$450 per square installed.`}{" "}
                  A roofing &ldquo;square&rdquo; is 100 sq ft of roof. We confirm
                  the exact measurement and price for free, on-site.
                </p>
              </details>
              <p className="mt-4 text-sm text-fg-inv-dim">
                Financing available — ask about low monthly payment options.
              </p>
            </>
          )}

          {intent !== "unknown" && (
          <>
          <div className="my-6 h-px w-full bg-line" />

          <p className="font-display text-lg font-bold text-fg-inv">
            {intent === "insurance"
              ? "Book your free storm inspection"
              : "Lock in your free exact quote"}
          </p>
          <p className="mb-4 mt-1 text-sm text-bolt">
            Inspections book up fast after storms — grab a spot this week.
          </p>
          <form onSubmit={submitLead} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" required placeholder="Full name" className={inputBase} autoComplete="name" />
              <input name="phone" required type="tel" placeholder="Phone" className={inputBase} autoComplete="tel" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="email" type="email" placeholder="Email (we'll send your details)" className={inputBase} autoComplete="email" />
              <input name="zip" placeholder="ZIP code" className={inputBase} inputMode="numeric" autoComplete="postal-code" />
            </div>
            <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={sub === "submitting"}
                className="flex-1 rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
              >
                {sub === "submitting"
                  ? "Sending…"
                  : intent === "insurance"
                    ? "Book my free inspection"
                    : "Get my FREE quote"}
              </button>
              <a
                href={site.textHref}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-line px-5 py-4 font-display text-base font-bold text-fg-inv transition-colors hover:border-bolt hover:text-bolt"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                  <path d="M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1z" />
                </svg>
                Text us
              </a>
            </div>
            {sub === "error" && (
              <p className="text-sm text-ember">Something went wrong — please call us.</p>
            )}
            <SmsConsent />
          </form>
          </>
          )}
        </>
      )}

      {sub === "done" && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bolt">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-ink">
              <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-fg-inv">
            You&apos;re booked in.
          </h2>
          <p className="mt-2 text-fg-inv-dim">
            We&apos;ll call to schedule your free on-site measurement and exact
            quote.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-md border border-line bg-ink p-3">
      <div className="font-display text-xl font-extrabold text-bolt">{big}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-fg-inv-dim">{small}</div>
    </div>
  );
}
