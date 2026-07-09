"use client";

import { useState } from "react";
import { SmsConsent } from "./SmsConsent";
import { leadContext } from "@/lib/leadContext";
import { track } from "@/lib/analytics";

/**
 * Sales-rep application form for /careers. Posts to /api/lead flagged as a
 * "Sales rep application" so it lands in the leads table + team email like any
 * other lead. Not homeowner-facing — recruiting only.
 */

const EXPERIENCE = [
  "New to roofing sales",
  "1–2 years",
  "3–5 years",
  "5+ years / team lead",
];
type Sub = "idle" | "submitting" | "done" | "error";

const inputBase =
  "w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";

export function RepApply() {
  const [exp, setExp] = useState("");
  const [sub, setSub] = useState<Sub>("idle");

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
          service: "Sales rep application",
          message: `[REP APPLICATION] experience: ${exp || "—"}; city: ${
            fd.city || "—"
          }${fd.note ? `; note: ${fd.note}` : ""}`,
          company_website: fd.company_website,
          ...leadContext({ tool: "careers" }),
        }),
      });
      if (!res.ok) throw new Error();
      track("lead_submit", { form: "rep_application", experience: exp || "na" });
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
          Got it — we&apos;ll reach out fast.
        </h3>
        <p className="mt-2 text-fg-inv-dim">
          Expect a call or text from our sales lead shortly. Come ready to talk
          numbers.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
      <h2 className="font-display text-2xl font-bold text-fg-inv">
        Apply in 60 seconds
      </h2>
      <p className="mt-1.5 text-sm text-fg-inv-dim">
        No résumé needed. Tell us how to reach you and we&apos;ll set up a quick
        call.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3" data-cr-capture id="crf-rep">
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" required placeholder="Full name" className={inputBase} autoComplete="name" />
          <input name="phone" required type="tel" placeholder="Phone" className={inputBase} autoComplete="tel" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="email" type="email" placeholder="Email" className={inputBase} autoComplete="email" />
          <input name="city" placeholder="City (DFW area)" className={inputBase} autoComplete="address-level2" />
        </div>
        <div>
          <div className="text-sm text-fg-inv-dim">Roofing sales experience</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {EXPERIENCE.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setExp(x)}
                className={`rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  exp === x
                    ? "border-bolt bg-bolt/10 text-bolt"
                    : "border-line text-fg-inv-dim hover:border-bolt"
                }`}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
        <textarea
          name="note"
          rows={2}
          placeholder="Anything we should know? (optional)"
          className={inputBase}
        />
        <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <button
          type="submit"
          disabled={sub === "submitting"}
          className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-extrabold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
        >
          {sub === "submitting" ? "Sending…" : "Apply now →"}
        </button>
        {sub === "error" && (
          <p className="text-sm text-ember">
            Something went wrong — please text us instead.
          </p>
        )}
        <SmsConsent />
      </form>
    </div>
  );
}
