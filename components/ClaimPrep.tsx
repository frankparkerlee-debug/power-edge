"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

/**
 * Claim-prep intake. The homeowner fills their own claim details online so the
 * crew arrives ready to inspect, photograph, and close — not do paperwork.
 * Prefills contact from ?name=&phone=&email=&address= (handed off from booking).
 * Framing is efficiency/prep only — we don't file or negotiate the claim.
 */

const DEDUCTIBLES = ["$500", "$1,000", "$2,500", "$5,000", "1% of home value", "Not sure"];
type Sub = "idle" | "submitting" | "done" | "error";

const inputBase =
  "w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";
const label = "block text-sm font-semibold text-fg-inv";

export function ClaimPrep() {
  const [filed, setFiled] = useState(false);
  const [solar, setSolar] = useState(false);
  const [deductible, setDeductible] = useState("");
  const [sub, setSub] = useState<Sub>("idle");
  const [prefill, setPrefill] = useState({ name: "", phone: "", email: "", address: "" });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setPrefill({
      name: q.get("name") || "",
      phone: q.get("phone") || "",
      email: q.get("email") || "",
      address: q.get("address") || q.get("a") || "",
    });
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSub("submitting");
    const fd = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    try {
      const res = await fetch("/api/claim-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fd, filed, solar, deductible }),
      });
      if (!res.ok) throw new Error();
      track("claim_intake_submit", {});
      setSub("done");
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
          You&apos;re ahead of the game.
        </h3>
        <p className="mt-2 text-fg-inv-dim">
          Thanks — your crew will show up already knowing the scope, so the visit
          is about the roof, not paperwork. We&apos;ll call to confirm your time.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Contact */}
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Full name</label>
            <input name="name" required defaultValue={prefill.name} className={`mt-1 ${inputBase}`} autoComplete="name" />
          </div>
          <div>
            <label className={label}>Phone</label>
            <input name="phone" required type="tel" defaultValue={prefill.phone} className={`mt-1 ${inputBase}`} autoComplete="tel" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Email</label>
            <input name="email" type="email" defaultValue={prefill.email} className={`mt-1 ${inputBase}`} autoComplete="email" />
          </div>
          <div>
            <label className={label}>Property address</label>
            <input name="address" defaultValue={prefill.address} className={`mt-1 ${inputBase}`} autoComplete="street-address" />
          </div>
        </div>
      </div>

      {/* Insurance */}
      <div className="rounded-card border border-line bg-ink p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-bolt">
          Your insurance
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Insurance carrier</label>
            <input name="carrier" placeholder="State Farm, Allstate…" className={`mt-1 ${inputBase}`} />
          </div>
          <div>
            <label className={label}>Policy number</label>
            <input name="policy_number" placeholder="Optional" className={`mt-1 ${inputBase}`} />
          </div>
        </div>
        <div className="mt-3">
          <label className={label}>Wind/hail deductible</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEDUCTIBLES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDeductible(d)}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  deductible === d
                    ? "border-bolt bg-bolt/10 text-bolt"
                    : "border-line text-fg-inv-dim hover:border-bolt"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Date of the storm (if known)</label>
            <input name="date_of_loss" type="date" className={`mt-1 ${inputBase}`} />
          </div>
          <div>
            <label className={label}>Mortgage company (optional)</label>
            <input name="mortgage_company" placeholder="Often listed on the claim check" className={`mt-1 ${inputBase}`} />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm text-fg-inv-dim">Have you filed a claim yet?</div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setFiled(false)}
              className={`flex-1 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors ${
                !filed ? "border-bolt bg-bolt/10 text-bolt" : "border-line text-fg-inv-dim"
              }`}
            >
              Not yet
            </button>
            <button
              type="button"
              onClick={() => setFiled(true)}
              className={`flex-1 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors ${
                filed ? "border-bolt bg-bolt/10 text-bolt" : "border-line text-fg-inv-dim"
              }`}
            >
              Yes, I filed
            </button>
          </div>
          {filed && (
            <input name="claim_number" placeholder="Claim number (if you have it)" className={`mt-2 ${inputBase}`} />
          )}
        </div>
      </div>

      {/* Roof */}
      <div className="space-y-3">
        <div>
          <label className={label}>What are you seeing? (leaks, missing shingles, rooms affected…)</label>
          <textarea name="concerns" rows={3} className={`mt-1 ${inputBase}`} placeholder="Anything you've noticed — helps us focus the inspection." />
        </div>
        <div>
          <label className={label}>Best times for the inspection</label>
          <input name="best_times" placeholder="e.g. weekday mornings, after 5pm…" className={`mt-1 ${inputBase}`} />
        </div>
        <label
          className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-4 py-3 text-sm transition-colors ${
            solar ? "border-bolt bg-bolt/10 text-fg-inv" : "border-line bg-ink text-fg-inv-dim"
          }`}
        >
          <input type="checkbox" checked={solar} onChange={(e) => setSolar(e.target.checked)} className="h-4 w-4 accent-bolt" />
          I have solar panels (we handle those too)
        </label>
      </div>

      <button
        type="submit"
        disabled={sub === "submitting"}
        className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-extrabold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
      >
        {sub === "submitting" ? "Saving…" : "Send my claim details →"}
      </button>
      {sub === "error" && (
        <p className="text-sm text-ember">Something went wrong — please call us instead.</p>
      )}
      <p className="text-center text-xs text-fg-inv-dim">
        We use these details to move fast on-site — we document and coordinate
        with your adjuster, and never file or negotiate the claim for you.
      </p>
    </form>
  );
}
