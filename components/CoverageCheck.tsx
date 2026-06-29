"use client";

import { useState } from "react";
import { SmsConsent } from "./SmsConsent";

/**
 * Free "Is your roof still fully covered?" checker — the site's primary lead
 * magnet. Value-first: it gives an honest read on the homeowner's coverage risk
 * BEFORE asking for contact info (on-brand for "the honest crew"), then converts
 * to a free on-site inspection. Submits to /api/lead with the answers attached.
 */

type Opt = { v: string; l: string };
type Step = { id: string; q: string; help?: string; opts: Opt[] };

const STEPS: Step[] = [
  {
    id: "age",
    q: "How old is your roof?",
    help: "A rough estimate is fine.",
    opts: [
      { v: "0-9", l: "0–9 years" },
      { v: "10-15", l: "10–15 years" },
      { v: "16-20", l: "16–20 years" },
      { v: "20+", l: "20+ years" },
      { v: "unsure", l: "Not sure" },
    ],
  },
  {
    id: "material",
    q: "What's your roof made of?",
    opts: [
      { v: "asphalt", l: "Asphalt shingles" },
      { v: "metal", l: "Metal" },
      { v: "tile", l: "Tile" },
      { v: "flat", l: "Flat / other" },
      { v: "unsure", l: "Not sure" },
    ],
  },
  {
    id: "storm",
    q: "Has a hail or wind storm hit your area in the last 2 years?",
    opts: [
      { v: "yes", l: "Yes" },
      { v: "no", l: "No" },
      { v: "unsure", l: "Not sure" },
    ],
  },
  {
    id: "inspected",
    q: "Has your roof been professionally inspected since that storm?",
    opts: [
      { v: "no", l: "No" },
      { v: "yes", l: "Yes, recently" },
      { v: "unsure", l: "Not sure" },
    ],
  },
  {
    id: "property",
    q: "Is this a home or a commercial property?",
    opts: [
      { v: "home", l: "Home" },
      { v: "commercial", l: "Commercial" },
    ],
  },
];

type Risk = "high" | "medium" | "low";

function scoreRisk(a: Record<string, string>): Risk {
  let s = 0;
  if (a.age === "20+") s += 3;
  else if (a.age === "16-20") s += 2;
  else if (a.age === "10-15") s += 1;
  else if (a.age === "unsure") s += 1;
  if (a.storm === "yes") s += 2;
  else if (a.storm === "unsure") s += 1;
  if (a.inspected === "no" && a.storm !== "no") s += 1;
  if (a.material === "asphalt") s += 1;
  if (s >= 4) return "high";
  if (s >= 2) return "medium";
  return "low";
}

const RESULTS: Record<Risk, { headline: string; body: string; accent: string }> = {
  high: {
    headline: "Your roof may be underinsured right now.",
    body: "Based on your answers, your roof is at the age and condition where many Texas insurers quietly switch coverage from full replacement cost to actual-cash-value — meaning a storm claim could pay you thousands less than a new roof actually costs. If a storm has come through, the window to document it and file matters. This is worth a free, no-pressure inspection and a written coverage check.",
    accent: "var(--color-ember)",
  },
  medium: {
    headline: "You're approaching the coverage cliff.",
    body: "Your roof is heading toward the age where Texas insurers start downgrading older roofs to actual-cash-value. The smart move is to document its condition now, while it's still likely on full replacement-cost coverage — so if a storm hits later, you have evidence on file. A free inspection gives you that paper trail.",
    accent: "var(--color-bolt)",
  },
  low: {
    headline: "You're likely in good shape — but worth confirming.",
    body: "Your roof is probably still on full replacement-cost coverage. If you've had a recent storm or you're buying or selling, a free inspection gives you a documented baseline so a future claim goes smoothly. No pressure either way — we'll tell you straight.",
    accent: "var(--color-bolt)",
  },
};

type Phase = "quiz" | "result";
type SubStatus = "idle" | "submitting" | "done" | "error";

export function CoverageCheck() {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>("quiz");
  const [sub, setSub] = useState<SubStatus>("idle");

  const step = STEPS[i];
  const progress = (i / STEPS.length) * 100;

  function pick(v: string) {
    const next = { ...answers, [step.id]: v };
    setAnswers(next);
    if (i + 1 < STEPS.length) setI(i + 1);
    else setPhase("result");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSub("submitting");
    const form = e.currentTarget;
    const fd = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const summary = STEPS.map((s) => {
      const opt = s.opts.find((o) => o.v === answers[s.id]);
      return `${s.q} ${opt?.l ?? "—"}`;
    }).join(" | ");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.name,
          phone: fd.phone,
          email: fd.email,
          zip: fd.zip,
          service: "Roof coverage check",
          message: `[Coverage Checker — risk: ${risk}] ${summary}`,
          company_website: fd.company_website,
        }),
      });
      if (!res.ok) throw new Error();
      setSub("done");
      form.reset();
    } catch {
      setSub("error");
    }
  }

  const risk = phase === "result" ? scoreRisk(answers) : "low";
  const r = RESULTS[risk];
  const inputBase =
    "w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";

  return (
    <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
      {phase === "quiz" && (
        <>
          {/* progress */}
          <div className="mb-6 flex items-center justify-between">
            <span className="kicker text-bolt">
              Step {i + 1} of {STEPS.length}
            </span>
            {i > 0 && (
              <button
                onClick={() => setI(i - 1)}
                className="text-sm text-fg-inv-dim hover:text-fg-inv"
              >
                ← Back
              </button>
            )}
          </div>
          <div className="mb-7 h-1 w-full rounded-full bg-line">
            <div
              className="h-1 rounded-full bg-bolt transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <h3 className="font-display text-2xl font-bold leading-tight text-fg-inv sm:text-3xl">
            {step.q}
          </h3>
          {step.help && (
            <p className="mt-2 text-sm text-fg-inv-dim">{step.help}</p>
          )}

          <div className="mt-6 grid gap-3">
            {step.opts.map((o) => (
              <button
                key={o.v}
                onClick={() => pick(o.v)}
                className="group flex items-center justify-between rounded-md border border-line bg-ink px-5 py-4 text-left font-medium text-fg-inv transition-colors hover:border-bolt hover:bg-steel"
              >
                {o.l}
                <span className="text-bolt opacity-0 transition-opacity group-hover:opacity-100">
                  →
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {phase === "result" && sub !== "done" && (
        <>
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
            style={{ color: r.accent, border: `1px solid ${r.accent}` }}
          >
            {risk === "high" ? "Act soon" : risk === "medium" ? "Worth checking" : "Looks okay"}
          </div>
          <h3 className="font-display text-2xl font-bold leading-tight text-fg-inv sm:text-3xl">
            {r.headline}
          </h3>
          <p className="mt-4 leading-relaxed text-fg-inv-dim">{r.body}</p>

          <div className="my-6 h-px w-full bg-line" />

          <p className="mb-4 font-display text-lg font-bold text-fg-inv">
            Get your free inspection + written coverage check
          </p>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" required placeholder="Full name" className={inputBase} autoComplete="name" />
              <input name="phone" required type="tel" placeholder="Phone" className={inputBase} autoComplete="tel" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="email" type="email" placeholder="Email (optional)" className={inputBase} autoComplete="email" />
              <input name="zip" placeholder="ZIP code" className={inputBase} inputMode="numeric" autoComplete="postal-code" />
            </div>
            <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <button
              type="submit"
              disabled={sub === "submitting"}
              className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
            >
              {sub === "submitting" ? "Sending…" : "Book my free roof check"}
            </button>
            {sub === "error" && (
              <p className="text-sm text-ember">
                Something went wrong — please call us instead.
              </p>
            )}
            <p className="text-center text-xs text-fg-inv-dim">
              No spam, no pressure. This is a general guide, not insurance advice —
              we&apos;ll confirm everything on-site.
            </p>
            <SmsConsent />
          </form>
        </>
      )}

      {sub === "done" && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bolt">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-ink">
              <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
            </svg>
          </div>
          <h3 className="font-display text-2xl font-bold text-fg-inv">
            You&apos;re booked in.
          </h3>
          <p className="mt-2 text-fg-inv-dim">
            We&apos;ll call you fast to schedule your free inspection and walk you
            through your coverage check.
          </p>
        </div>
      )}
    </div>
  );
}
