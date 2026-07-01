"use client";

import { useState } from "react";
import { SmsConsent } from "./SmsConsent";
import { leadContext } from "@/lib/leadContext";
import { track } from "@/lib/analytics";

/**
 * Financing pre-qualification capture. Collects the NON-sensitive inputs needed
 * to kick off a quick soft-pull underwrite (name, contact, property, amount) +
 * explicit consent. We deliberately DON'T collect SSN/DOB here — that belongs in
 * the soft-pull provider's secure widget (SoftPull/Array/etc.) once wired. Until
 * then this captures a flagged "Financing pre-qualification" lead the team can
 * run the soft pull on. Compliant: soft check, no score impact, consent-gated.
 */

const AMOUNTS = ["$1,000", "$2,500", "$5,000", "$8,000", "$10,000", "$15,000+"];
type Sub = "idle" | "submitting" | "done" | "error";

const inputBase =
  "w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";

export function FinancingPrequal() {
  const [amount, setAmount] = useState("$5,000");
  const [consent, setConsent] = useState(false);
  const [sub, setSub] = useState<Sub>("idle");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) return;
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
          service: "Financing pre-qualification",
          message: `[Financing Prequal] amount: ${amount}; property: ${
            fd.address || "—"
          }`,
          company_website: fd.company_website,
          ...leadContext({ tool: "financing-prequal" }),
        }),
      });
      if (!res.ok) throw new Error();
      track("lead_submit", { form: "financing_prequal" });
      setSub("done");
      form.reset();
    } catch {
      setSub("error");
    }
  }

  if (sub === "done") {
    return (
      <div className="rounded-card border border-bolt/40 bg-bolt/10 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bolt">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-ink">
            <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
          </svg>
        </div>
        <h3 className="font-display text-2xl font-bold text-fg-inv">
          You&apos;re in — no credit impact.
        </h3>
        <p className="mt-2 text-fg-inv-dim">
          We&apos;ll reach out to pre-qualify you and walk through your options.
          It won&apos;t affect your credit score.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
      <h2 className="font-display text-2xl font-bold text-fg-inv">
        Pre-qualify in 60 seconds
      </h2>
      <p className="mt-1.5 text-sm text-fg-inv-dim">
        See what you qualify for with a{" "}
        <strong className="text-fg-inv">soft check that won&apos;t touch your
        credit score.</strong>{" "}
        No SSN needed to start.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3" data-cr-capture id="crf-prequal">
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" required placeholder="Full name" className={inputBase} autoComplete="name" />
          <input name="phone" required type="tel" placeholder="Phone" className={inputBase} autoComplete="tel" />
        </div>
        <input name="email" required type="email" placeholder="Email" className={inputBase} autoComplete="email" />
        <input name="address" placeholder="Property address" className={inputBase} autoComplete="street-address" />
        <input name="zip" placeholder="ZIP code" className={inputBase} inputMode="numeric" autoComplete="postal-code" />

        <div>
          <div className="text-sm text-fg-inv-dim">Amount you&apos;d finance</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  amount === a
                    ? "border-bolt bg-bolt/10 text-bolt"
                    : "border-line text-fg-inv-dim hover:border-bolt"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

        <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-ink px-4 py-3 text-xs leading-relaxed text-fg-inv-dim">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-bolt"
          />
          <span>
            I authorize PowerEdge to contact me and, with my permission, run a
            <strong className="text-fg-inv"> soft credit check</strong> to
            pre-qualify me. A soft check <strong className="text-fg-inv">won&apos;t
            affect my credit score</strong>. Final terms are provided in writing
            before I sign; I always pay my full deductible.
          </span>
        </label>

        <button
          type="submit"
          disabled={sub === "submitting" || !consent}
          className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-50"
        >
          {sub === "submitting" ? "Sending…" : "See what I pre-qualify for →"}
        </button>
        {sub === "error" && (
          <p className="text-sm text-ember">
            Something went wrong — please call us instead.
          </p>
        )}
        <SmsConsent />
      </form>
    </div>
  );
}
