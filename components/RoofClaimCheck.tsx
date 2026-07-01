"use client";

import { useState } from "react";
import { SmsConsent } from "./SmsConsent";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { HailMap } from "./HailMap";
import { DeductibleFinancing } from "./DeductibleFinancing";
import { leadContext } from "@/lib/leadContext";
import { track } from "@/lib/analytics";
import type { StormData } from "./StormReport";

/**
 * Combined roof-claim eligibility check — merges the old storm-check + roof
 * estimate into ONE binary funnel. Enter address -> silent NWS hail lookup +
 * 3 quick questions -> a yes/no-style verdict on likely claim eligibility ->
 * book the free inspection. The storm detail is demoted to supporting evidence;
 * the verdict + booking are the point. Honest framing: never "your roof is
 * damaged" / "you have a claim" — only "you likely qualify… an inspection
 * confirms." Not an insurance determination.
 */

type Result = StormData & { ok?: boolean; found?: boolean; soft?: boolean };
type Phase = "input" | "questions" | "result";
type Sub = "idle" | "submitting" | "done" | "error";

const AGES = ["0–9 years", "10–15 years", "16–20 years", "20+ / not sure"];
const SIGNS = [
  { key: "leaks", label: "Leaks or ceiling stains" },
  { key: "missing", label: "Missing / cracked shingles" },
  { key: "granules", label: "Granules in the gutters" },
  { key: "none", label: "Nothing I've noticed" },
];

function monthsAgo(iso?: string) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86400000 / 30.44;
}

const inputBase =
  "w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";

export function RoofClaimCheck() {
  const [phase, setPhase] = useState<Phase>("input");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [age, setAge] = useState("");
  const [signs, setSigns] = useState<string[]>([]);
  const [solar, setSolar] = useState(false);
  const [sub, setSub] = useState<Sub>("idle");

  async function runCheck(addr: string) {
    if (!addr.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/storm-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      setResult((await res.json()) as Result);
    } catch {
      setResult({ soft: true });
    } finally {
      setLoading(false);
      setPhase("questions");
    }
  }

  function toggleSign(key: string) {
    setSigns((prev) => {
      if (key === "none") return prev.includes("none") ? [] : ["none"];
      const next = prev.filter((s) => s !== "none");
      return next.includes(key)
        ? next.filter((s) => s !== key)
        : [...next, key];
    });
  }

  // ---- Verdict logic ------------------------------------------------------
  const hailCount = result?.count ?? 0;
  const largest = result?.largest?.size ?? 0;
  const hailHit = !!result?.found && hailCount > 0;
  const oldRoof = age !== "" && age !== "0–9 years";
  const hasSigns = signs.some((s) => s !== "none");
  const qualifies = (hailHit && (oldRoof || hasSigns)) || largest >= 1.5;

  const recentIso = result?.mostRecent?.date || result?.largest?.date;
  const monthsLeft = Math.round(12 - monthsAgo(recentIso));
  const hailSummary = hailHit
    ? `${hailCount} hail report${hailCount === 1 ? "" : "s"} within ${result?.radiusMi ?? 15} mi${
        largest ? `, largest ${largest}″` : ""
      }`
    : "no strong hail reports in recent auto data";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSub("submitting");
    const form = e.currentTarget;
    const fd = Object.fromEntries(new FormData(form).entries()) as Record<
      string,
      string
    >;
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.name,
          phone: fd.phone,
          email: fd.email,
          zip: fd.zip,
          service: qualifies
            ? "Roof claim check (LIKELY QUALIFIES)"
            : "Roof claim check (worth a look)",
          solar: solar ? "yes" : "",
          message: `[Roof Claim Check] ${
            qualifies ? "LIKELY QUALIFIES" : "worth a look"
          } — ${result?.matched || address}; hail: ${hailSummary}; roof age: ${
            age || "—"
          }; signs: ${signs.join(", ") || "none"}`,
          company_website: fd.company_website,
          ...leadContext({ tool: "roof-claim-check" }),
        }),
      });
      if (!res.ok) throw new Error();
      track("lead_submit", {
        form: "roof_claim_check",
        qualifies: qualifies ? "yes" : "no",
        solar: solar ? "yes" : "no",
      });
      setSub("done");
      form.reset();
    } catch {
      setSub("error");
    }
  }

  // ---- INPUT --------------------------------------------------------------
  if (phase === "input") {
    return (
      <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
        <h2 className="font-display text-2xl font-bold text-fg-inv">
          Do you have a roof claim? Find out free.
        </h2>
        <p className="mt-2 text-sm text-fg-inv-dim">
          Enter your address and answer three quick questions. We&apos;ll check
          reported hail near your home and tell you if it&apos;s likely worth
          filing — in about a minute, no obligation.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runCheck(address);
          }}
          className="mt-6 space-y-3"
        >
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onSelect={(v) => runCheck(v)}
            placeholder="Street address or ZIP code"
            className={inputBase}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
          >
            {loading ? "Checking storm data…" : "Check my roof"}
          </button>
        </form>
        <p className="mt-3 text-center text-xs text-fg-inv-dim">
          Data from NWS / NOAA storm reports. This isn&apos;t an insurance
          determination — a free inspection confirms it.
        </p>
      </div>
    );
  }

  // ---- QUESTIONS ----------------------------------------------------------
  if (phase === "questions") {
    return (
      <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={() => setPhase("input")}
          className="text-xs text-fg-inv-dim hover:text-fg-inv"
        >
          ← Different address
        </button>
        <h2 className="mt-2 font-display text-2xl font-bold text-fg-inv">
          Three quick questions
        </h2>
        <p className="mt-1 text-sm text-fg-inv-dim">
          {result?.matched ? `For ${result.matched}` : "Almost there"} — this
          sharpens the read.
        </p>

        {/* Roof age */}
        <div className="mt-6">
          <div className="text-sm font-semibold text-fg-inv">
            How old is your roof?
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {AGES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAge(a)}
                className={`rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  age === a
                    ? "border-bolt bg-bolt/10 text-bolt"
                    : "border-line text-fg-inv-dim hover:border-bolt"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Signs */}
        <div className="mt-5">
          <div className="text-sm font-semibold text-fg-inv">
            Noticed any of these? (optional)
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SIGNS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSign(s.key)}
                className={`rounded-md border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  signs.includes(s.key)
                    ? "border-bolt bg-bolt/10 text-bolt"
                    : "border-line text-fg-inv-dim hover:border-bolt"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Solar */}
        <label
          className={`mt-5 flex cursor-pointer items-center gap-2.5 rounded-md border px-4 py-3 text-sm transition-colors ${
            solar
              ? "border-bolt bg-bolt/10 text-fg-inv"
              : "border-line bg-ink text-fg-inv-dim"
          }`}
        >
          <input
            type="checkbox"
            checked={solar}
            onChange={(e) => setSolar(e.target.checked)}
            className="h-4 w-4 accent-bolt"
          />
          I have solar panels on my roof
        </label>

        <button
          type="button"
          disabled={!age}
          onClick={() => setPhase("result")}
          className="mt-6 w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-50"
        >
          {age ? "See if I qualify →" : "Pick your roof age to continue"}
        </button>
      </div>
    );
  }

  // ---- RESULT -------------------------------------------------------------
  if (sub === "done") {
    return (
      <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
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
            We&apos;ll call you fast to schedule your free inspection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
      {/* Verdict */}
      {qualifies ? (
        <div className="rounded-card border-2 border-bolt bg-bolt/10 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-bolt">
            Good news
          </div>
          <p className="mt-1 font-display text-2xl font-bold leading-tight text-fg-inv sm:text-3xl">
            You likely qualify for a roof insurance claim.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-fg-inv-dim">
            Based on {hailSummary} and your roof&apos;s age, it&apos;s worth
            filing. A free inspection documents the damage and confirms it — and
            on a covered claim you typically pay only your deductible.
          </p>
        </div>
      ) : (
        <div className="rounded-card border border-line bg-ink p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-fg-inv-dim">
            Worth a free look
          </div>
          <p className="mt-1 font-display text-2xl font-bold leading-tight text-fg-inv sm:text-3xl">
            Let&apos;s get eyes on your roof.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-fg-inv-dim">
            The auto-data isn&apos;t conclusive ({hailSummary}), but North Texas
            gets hit often and damage is easy to miss from the ground. A free
            inspection is the only way to know for sure.
          </p>
        </div>
      )}

      {/* Claim-window urgency */}
      {hailHit && monthsLeft > 0 && monthsLeft < 13 && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-fg-inv">
          <span aria-hidden>⏳</span>
          <span>
            Many Texas policies give you about a year from the storm to file —
            that could be roughly{" "}
            <strong>{monthsLeft} month{monthsLeft === 1 ? "" : "s"} left</strong>{" "}
            on the most recent event. Check your policy; don&apos;t sit on it.
          </span>
        </div>
      )}

      {/* Evidence map (supporting, not the star) */}
      {hailHit && result?.home && result?.map && result.map.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-md border border-line">
          <HailMap home={result.home} points={result.map} />
        </div>
      )}

      {solar && (
        <p className="mt-4 rounded-md border border-bolt/30 bg-bolt/10 px-4 py-3 text-sm leading-relaxed text-fg-inv">
          You have solar — good. We detach &amp; reset your panels in-house (most
          roofers can&apos;t), and it&apos;s usually a covered line item on your
          claim.
        </p>
      )}

      <div className="mt-4">
        <DeductibleFinancing />
      </div>

      <div className="my-6 h-px w-full bg-line" />

      <p className="font-display text-lg font-bold text-fg-inv">
        Book your free inspection
      </p>
      <p className="mb-4 mt-1 text-sm text-bolt">
        Inspections book up fast after storms — grab a spot this week.
      </p>
      <form id="crf-claim" data-cr-capture onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" required placeholder="Full name" className={inputBase} autoComplete="name" />
          <input name="phone" required type="tel" placeholder="Phone" className={inputBase} autoComplete="tel" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="email" type="email" placeholder="Email (we'll send your details)" className={inputBase} autoComplete="email" />
          <input name="zip" placeholder="ZIP code" className={inputBase} inputMode="numeric" autoComplete="postal-code" />
        </div>
        <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <button
          type="submit"
          disabled={sub === "submitting"}
          className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
        >
          {sub === "submitting" ? "Sending…" : "Book my free inspection"}
        </button>
        {sub === "error" && (
          <p className="text-sm text-ember">
            Something went wrong — please call us instead.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setPhase("input");
            setResult(null);
            setAge("");
            setSigns([]);
          }}
          className="w-full text-center text-xs text-fg-inv-dim hover:text-fg-inv"
        >
          ← Start over
        </button>
        <SmsConsent />
      </form>
    </div>
  );
}
