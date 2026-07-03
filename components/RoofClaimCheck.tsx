"use client";

import { useEffect, useState } from "react";
import { SmsConsent } from "./SmsConsent";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { HailMap } from "./HailMap";
import { leadContext } from "@/lib/leadContext";
import { track } from "@/lib/analytics";
import type { StormData } from "./StormReport";

/**
 * Roof-claim eligibility check, tuned for paid/mobile traffic.
 * FORM-FORWARD: address → compact verdict + one urgency line → the booking form
 * right there (so there's always somewhere to submit without endless scroll);
 * stakes + evidence + financing detail live BELOW the form as reinforcement.
 * Urgency is imminent-threat ("before the next storm makes it worse"), not a
 * reassuring deadline countdown. Honest framing: never "your roof is damaged" /
 * "you have a claim" — only "you likely qualify… an inspection confirms."
 */

type Result = StormData & { ok?: boolean; found?: boolean; soft?: boolean };
type Phase = "input" | "result";
type Sub = "idle" | "submitting" | "done" | "error";

const inputBase =
  "w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";

export function RoofClaimCheck() {
  const [phase, setPhase] = useState<Phase>("input");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [solar, setSolar] = useState(false);
  const [sub, setSub] = useState<Sub>("idle");
  const [booked, setBooked] = useState({ name: "", phone: "", email: "" });

  // Handoff from the homepage band: /roof-claim-check?a=<address> auto-runs.
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get("a");
    if (a) {
      setAddress(a);
      runCheck(a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setPhase("result");
    }
  }

  const hailCount = result?.count ?? 0;
  const largest = result?.largest?.size ?? 0;
  const hailHit = !!result?.found && hailCount > 0;
  const qualifies = hailHit && (largest >= 1 || hailCount >= 3);
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
          address: result?.matched || address,
          service: qualifies
            ? "Roof claim check (LIKELY QUALIFIES)"
            : "Roof claim check (worth a look)",
          solar: solar ? "yes" : "",
          message: `[Roof Claim Check] ${
            qualifies ? "LIKELY QUALIFIES" : "worth a look"
          } — ${result?.matched || address}; hail: ${hailSummary}`,
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
      setBooked({ name: fd.name || "", phone: fd.phone || "", email: fd.email || "" });
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
          Enter your address — we check reported hail near your home and tell you
          on the spot if it&apos;s likely worth filing. Takes seconds, no
          obligation.
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
            {loading ? "Checking storm data…" : "Check my roof →"}
          </button>
        </form>
        <p className="mt-3 text-center text-xs text-fg-inv-dim">
          Data from NWS / NOAA storm reports. This isn&apos;t an insurance
          determination — a free inspection confirms it.
        </p>
      </div>
    );
  }

  // ---- BOOKED -------------------------------------------------------------
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
            We&apos;ll call you fast to lock in your free inspection.
          </p>
        </div>
        <a
          href={`/claim-prep?name=${encodeURIComponent(booked.name)}&phone=${encodeURIComponent(booked.phone)}&email=${encodeURIComponent(booked.email)}&address=${encodeURIComponent(result?.matched || address)}`}
          className="mt-2 flex items-center justify-between rounded-card border-2 border-bolt/50 bg-bolt/10 p-5 transition-colors hover:border-bolt"
        >
          <div>
            <div className="font-display text-base font-bold text-fg-inv">
              Want us in and out fast? Prep your claim (2 min).
            </div>
            <div className="mt-0.5 text-sm text-fg-inv-dim">
              Add your carrier + deductible so we inspect and close on-site.
            </div>
          </div>
          <span className="font-display font-bold text-bolt">→</span>
        </a>
      </div>
    );
  }

  // ---- RESULT + CAPTURE (form-forward) ------------------------------------
  return (
    <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
      {/* Compact verdict */}
      {qualifies ? (
        <div className="rounded-card border-2 border-bolt bg-bolt/10 p-4 sm:p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-bolt">
            Good news — you likely qualify
          </div>
          <p className="mt-1 font-display text-2xl font-bold leading-tight text-fg-inv">
            {largest ? `${largest}″ hail hit near you.` : "Hail hit near you."}{" "}
            Your roof may already be damaged.
          </p>
          <p className="mt-1.5 text-sm text-fg-inv-dim">
            {hailSummary} — enough to file. Book your free inspection now, before
            it gets worse.
          </p>
        </div>
      ) : (
        <div className="rounded-card border border-line bg-ink p-4 sm:p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-fg-inv-dim">
            Worth a free look
          </div>
          <p className="mt-1 font-display text-2xl font-bold leading-tight text-fg-inv">
            Damage hides — until it&apos;s a leak.
          </p>
          <p className="mt-1.5 text-sm text-fg-inv-dim">
            North Texas gets pounded and hail damage is nearly invisible from the
            ground. A free inspection is the only way to know for sure.
          </p>
        </div>
      )}

      {/* One imminent-threat urgency line */}
      <div className="mt-3 flex items-start gap-2 rounded-md border border-ember/40 bg-ember/10 px-4 py-3 text-sm font-semibold text-fg-inv">
        <span aria-hidden>⚡</span>
        <span>
          Act before the next storm makes it worse — every round of hail and rain
          deepens the damage and makes it harder to claim.
        </span>
      </div>

      {/* THE FORM — right here, no endless scroll */}
      <div className="mt-5">
        <p className="font-display text-lg font-bold text-fg-inv">
          Lock in your free inspection
        </p>
        <form id="crf-claim" data-cr-capture onSubmit={submit} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="name" required placeholder="Full name" className={inputBase} autoComplete="name" />
            <input name="phone" required type="tel" placeholder="Phone" className={inputBase} autoComplete="tel" />
          </div>
          <input name="email" type="email" placeholder="Email (optional)" className={inputBase} autoComplete="email" />
          <label
            className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-4 py-3 text-sm transition-colors ${
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
            I have solar panels (we handle those too)
          </label>
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <button
            type="submit"
            disabled={sub === "submitting"}
            className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-extrabold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
          >
            {sub === "submitting" ? "Sending…" : "Lock in my free inspection →"}
          </button>
          {sub === "error" && (
            <p className="text-sm text-ember">
              Something went wrong — please call us instead.
            </p>
          )}
          {/* Financing reassurance, right at the point of action */}
          <p className="text-center text-xs text-fg-inv-dim">
            Deductible tight? <strong className="text-bolt">Finance it from $250 down</strong> — paid in full over time, never waived.
          </p>
          <SmsConsent />
        </form>
      </div>

      {/* Reinforcement BELOW the form (for scrollers) */}
      <div className="mt-6 border-t border-line pt-5">
        <div className="text-xs font-bold uppercase tracking-wider text-ember">
          Why waiting costs you
        </div>
        <ul className="mt-3 space-y-2.5 text-sm text-fg-inv-dim">
          <li className="flex gap-2.5">
            <span className="text-ember" aria-hidden>→</span>
            <span>
              <strong className="text-fg-inv">The next storm makes it worse.</strong>{" "}
              Each round of hail and rain deepens the damage — and muddies which
              storm caused it.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-ember" aria-hidden>→</span>
            <span>
              <strong className="text-fg-inv">A cheap fix becomes a claim fight.</strong>{" "}
              What&apos;s minor now turns into leaks, rot, and interior damage
              insurers push back on.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-ember" aria-hidden>→</span>
            <span>
              <strong className="text-fg-inv">The window won&apos;t stay open.</strong>{" "}
              Let the filing deadline pass and the whole roof is on you — not just
              your deductible.
            </span>
          </li>
        </ul>
      </div>

      {hailHit && result?.home && result?.map && result.map.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-md border border-line">
          <HailMap home={result.home} points={result.map} />
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setPhase("input");
          setResult(null);
        }}
        className="mt-4 w-full text-center text-xs text-fg-inv-dim hover:text-fg-inv"
      >
        ← Check a different address
      </button>
    </div>
  );
}
