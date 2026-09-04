"use client";

import { useEffect, useState } from "react";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { track } from "@/lib/analytics";
import { site } from "@/lib/site";

/**
 * Staged "start your claim" wizard. Order per claim research (maximizes
 * completion): Stage 1 = easy hook (address/storm/what-you-see/contact),
 * Stage 2 = damage + BOOK the inspection (the conversion), Stage 3 = OPTIONAL
 * policy details (carrier/policy#/deductible) — kept last + optional because
 * making people dig out the declarations page is the #1 abandon point.
 *
 * Progressive save: each step upserts one row (by id) so partial progress
 * persists and the drop-off nurture can reach people who don't finish.
 *
 * COMPLIANCE (TX Ins. Code Ch. 4102 / Stonewater): policy # optional, no SSN,
 * we "document & coordinate," never file/negotiate — see the disclaimer.
 */

const CAUSES = ["Hail", "Wind", "Not sure"];
const SIGNS = [
  "Missing / curling shingles",
  "Leak or ceiling stain",
  "Dented gutters or downspouts",
  "Granules in the gutters",
  "No visible damage — just concerned",
];
const AGES = ["0–9 yrs", "10–15 yrs", "16–20 yrs", "20+ / not sure"];
const DEDUCTIBLES = ["$500", "$1,000", "$2,500", "$5,000", "1% of home value", "Not sure"];
const COVERAGE = ["Replacement cost", "Actual cash value", "Not sure"];

type Step = "1" | "2" | "booked" | "3" | "done";
type Data = {
  name: string; phone: string; email: string; address: string;
  date_of_loss: string; causes: string[]; damage_signs: string[];
  roof_age: string; concerns: string; mortgage_company: string;
  best_times: string; solar: boolean;
  carrier: string; policy_number: string; deductible: string; coverage_type: string;
};

const inputBase =
  "w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";
const lbl = "block text-sm font-semibold text-fg-inv";
const chip = (on: boolean) =>
  `rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
    on ? "border-bolt bg-bolt/10 text-bolt" : "border-line text-fg-inv-dim hover:border-bolt"
  }`;

const empty: Data = {
  name: "", phone: "", email: "", address: "", date_of_loss: "", causes: [],
  damage_signs: [], roof_age: "", concerns: "", mortgage_company: "", best_times: "",
  solar: false, carrier: "", policy_number: "", deductible: "", coverage_type: "",
};

export function ClaimPrep() {
  const [id, setId] = useState("");
  const [step, setStep] = useState<Step>("1");
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState<Data>(empty);
  // Anti-spam: honeypot (bots fill hidden fields) + start time (bots submit
  // instantly). Neither is visible to a real homeowner.
  const [hp, setHp] = useState("");
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const resume = q.get("resume");
    const existing = resume || localStorage.getItem("pe_claim_id") || crypto.randomUUID();
    localStorage.setItem("pe_claim_id", existing);
    setId(existing);
    setD((p) => ({
      ...p,
      name: q.get("name") || p.name,
      phone: q.get("phone") || p.phone,
      email: q.get("email") || p.email,
      address: q.get("address") || q.get("a") || p.address,
    }));
  }, []);

  const set = <K extends keyof Data>(k: K, v: Data[K]) => setD((p) => ({ ...p, [k]: v }));
  const toggleSign = (s: string) =>
    setD((p) => ({
      ...p,
      damage_signs: p.damage_signs.includes(s)
        ? p.damage_signs.filter((x) => x !== s)
        : [...p.damage_signs, s],
    }));
  const toggleCause = (c: string) =>
    setD((p) => {
      if (c === "Not sure")
        return { ...p, causes: p.causes.includes("Not sure") ? [] : ["Not sure"] };
      const base = p.causes.filter((x) => x !== "Not sure");
      return {
        ...p,
        causes: base.includes(c) ? base.filter((x) => x !== c) : [...base, c],
      };
    });

  async function save(stage: number, completed: boolean) {
    if (!id) return;
    setSaving(true);
    try {
      await fetch("/api/claim-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...d,
          cause: d.causes.join(", "),
          damage_signs: d.damage_signs.join(", "),
          id,
          stage,
          completed,
          company_website: hp, // honeypot — must stay empty
          form_elapsed_ms: Date.now() - startedAt,
        }),
      });
    } catch {
      /* best-effort; progressive save */
    }
    setSaving(false);
  }

  const Disclaimer = () => (
    <p className="mt-4 text-center text-xs leading-relaxed text-fg-inv-dim">
      PowerEdge is a licensed roofing contractor, not a
      public insurance adjuster. We document damage and coordinate our inspection
      with your adjuster; you file and manage your claim with your insurer.
    </p>
  );

  const Honeypot = () => (
    <input
      type="text"
      name="company_website"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      value={hp}
      onChange={(e) => setHp(e.target.value)}
      className="absolute left-[-9999px] h-0 w-0 opacity-0"
    />
  );

  const Progress = ({ n }: { n: number }) => (
    <div className="mb-5">
      <Honeypot />
      <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-fg-inv-dim">
        <span>Step {n} of 3</span>
        <span>{n === 1 ? "Your home & the storm" : n === 2 ? "Damage & scheduling" : "Policy details (optional)"}</span>
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-line">
        <div className="h-1 rounded-full bg-bolt transition-all" style={{ width: `${(n / 3) * 100}%` }} />
      </div>
    </div>
  );

  // ---- DONE ---------------------------------------------------------------
  if (step === "done") {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bolt">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-ink"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" /></svg>
        </div>
        <h3 className="font-display text-2xl font-bold text-fg-inv">You&apos;re all set.</h3>
        <p className="mt-2 text-fg-inv-dim">
          A licensed member of our team will call you <strong className="text-fg-inv">right away</strong> to
          lock in your inspection — and we&apos;ll arrive ready to get on the roof, not do paperwork.
        </p>
        <p className="mt-3 text-sm text-fg-inv-dim">Need us now? Call or text {site.phone}.</p>
      </div>
    );
  }

  // ---- BOOKED (interstitial after stage 2) --------------------------------
  if (step === "booked") {
    return (
      <div className="py-2 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bolt">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-ink"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" /></svg>
        </div>
        <h3 className="font-display text-2xl font-bold text-fg-inv">You&apos;re booked in.</h3>
        <p className="mt-2 text-fg-inv-dim">
          We&apos;ll call you <strong className="text-fg-inv">right away</strong> to confirm your time.
        </p>
        <div className="mt-6 rounded-card border border-line bg-ink p-5 text-left">
          <p className="font-display text-base font-bold text-fg-inv">
            Want us in and out even faster?
          </p>
          <p className="mt-1 text-sm text-fg-inv-dim">
            Add your policy details (2 optional fields) so we arrive ready to open the claim on-site.
          </p>
          <button
            onClick={() => setStep("3")}
            className="mt-4 w-full rounded-md bg-bolt px-6 py-3 font-display font-bold text-ink transition-colors hover:bg-bolt-hi"
          >
            Add policy details →
          </button>
          <button
            onClick={() => setStep("done")}
            className="mt-2 w-full text-center text-xs text-fg-inv-dim hover:text-fg-inv"
          >
            Skip — I&apos;ll bring them to the visit
          </button>
        </div>
        <Disclaimer />
      </div>
    );
  }

  // ---- STEP 3 — optional policy -------------------------------------------
  if (step === "3") {
    return (
      <form
        onSubmit={async (e) => { e.preventDefault(); await save(3, true); track("claim_step", { step: "3" }); setStep("done"); }}
        className="space-y-4"
      >
        <Progress n={3} />
        <p className="text-sm text-fg-inv-dim">
          All optional — it just speeds up the on-site claim. No policy number handy? Bring it to the visit.
        </p>
        <div>
          <label className={lbl}>Insurance carrier</label>
          <input value={d.carrier} onChange={(e) => set("carrier", e.target.value)} placeholder="State Farm, Allstate…" className={`mt-1 ${inputBase}`} />
        </div>
        <div>
          <label className={lbl}>Policy number <span className="font-normal text-fg-inv-dim">(optional)</span></label>
          <input value={d.policy_number} onChange={(e) => set("policy_number", e.target.value)} placeholder="Or bring it to the visit" className={`mt-1 ${inputBase}`} />
        </div>
        <div>
          <label className={lbl}>Wind/hail deductible <span className="font-normal text-fg-inv-dim">(for planning)</span></label>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEDUCTIBLES.map((x) => (
              <button type="button" key={x} onClick={() => set("deductible", x)} className={chip(d.deductible === x)}>{x}</button>
            ))}
          </div>
        </div>
        <div>
          <label className={lbl}>Coverage type</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {COVERAGE.map((x) => (
              <button type="button" key={x} onClick={() => set("coverage_type", x)} className={chip(d.coverage_type === x)}>{x}</button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={saving} className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-extrabold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60">
          {saving ? "Saving…" : "Save & finish →"}
        </button>
        <button type="button" onClick={() => setStep("done")} className="w-full text-center text-xs text-fg-inv-dim hover:text-fg-inv">
          Skip — I&apos;ll bring them to the visit
        </button>
        <Disclaimer />
      </form>
    );
  }

  // ---- STEP 2 — damage + book ---------------------------------------------
  if (step === "2") {
    return (
      <form
        onSubmit={async (e) => { e.preventDefault(); await save(2, true); track("claim_step", { step: "2_booked" }); setStep("booked"); }}
        className="space-y-4"
      >
        <Progress n={2} />
        <div>
          <label className={lbl}>About how old is your roof?</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {AGES.map((x) => (
              <button type="button" key={x} onClick={() => set("roof_age", x)} className={chip(d.roof_age === x)}>{x}</button>
            ))}
          </div>
        </div>
        <div>
          <label className={lbl}>Anything else you&apos;re seeing? <span className="font-normal text-fg-inv-dim">(rooms affected, when it started…)</span></label>
          <textarea value={d.concerns} onChange={(e) => set("concerns", e.target.value)} rows={2} className={`mt-1 ${inputBase}`} placeholder="Helps us focus the inspection." />
        </div>
        <div>
          <label className={lbl}>Mortgage company <span className="font-normal text-fg-inv-dim">(optional)</span></label>
          <input value={d.mortgage_company} onChange={(e) => set("mortgage_company", e.target.value)} placeholder="Often listed on the claim check" className={`mt-1 ${inputBase}`} />
        </div>
        <div>
          <label className={lbl}>Best times for the inspection</label>
          <input value={d.best_times} onChange={(e) => set("best_times", e.target.value)} placeholder="e.g. weekday mornings, after 5pm…" className={`mt-1 ${inputBase}`} />
        </div>
        <label className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-4 py-3 text-sm ${d.solar ? "border-bolt bg-bolt/10 text-fg-inv" : "border-line bg-ink text-fg-inv-dim"}`}>
          <input type="checkbox" checked={d.solar} onChange={(e) => set("solar", e.target.checked)} className="h-4 w-4 accent-bolt" />
          I have solar panels
        </label>
        <p className="rounded-md border border-line bg-ink px-4 py-3 text-xs leading-relaxed text-fg-inv-dim">
          📸 Got photos of the damage? Text them to <strong className="text-fg-inv">{site.textNumber}</strong> — it speeds up your claim.
        </p>
        <button type="submit" disabled={saving} className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-extrabold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60">
          {saving ? "Saving…" : "Book my free inspection →"}
        </button>
        <button type="button" onClick={() => setStep("1")} className="w-full text-center text-xs text-fg-inv-dim hover:text-fg-inv">← Back</button>
      </form>
    );
  }

  // ---- STEP 1 — the hook --------------------------------------------------
  return (
    <form
      onSubmit={async (e) => { e.preventDefault(); await save(1, false); track("claim_step", { step: "1" }); setStep("2"); }}
      className="space-y-4"
    >
      <Progress n={1} />
      <div>
        <label className={lbl}>Property address</label>
        <AddressAutocomplete value={d.address} onChange={(v) => set("address", v)} onSelect={(v) => set("address", v)} placeholder="Street address" className={`mt-1 ${inputBase}`} />
      </div>
      <div>
        <label className={lbl}>What caused it? <span className="font-normal text-fg-inv-dim">(pick any — wind and hail can both hit)</span></label>
        <div className="mt-1 flex gap-2">
          {CAUSES.map((x) => (
            <button type="button" key={x} onClick={() => toggleCause(x)} className={`flex-1 ${chip(d.causes.includes(x))}`}>{x}</button>
          ))}
        </div>
      </div>
      <div>
        <label className={lbl}>When did it hit? <span className="font-normal text-fg-inv-dim">(rough date is fine — or leave blank)</span></label>
        <input type="date" value={d.date_of_loss} onChange={(e) => set("date_of_loss", e.target.value)} className={`mt-1 ${inputBase}`} />
        <p className="mt-1 text-xs text-fg-inv-dim">
          Not sure which storm? No problem — we&apos;ll pull the storm history for your address.
        </p>
      </div>
      <div>
        <label className={lbl}>What are you seeing?</label>
        <div className="mt-2 grid gap-2">
          {SIGNS.map((x) => (
            <button type="button" key={x} onClick={() => toggleSign(x)} className={`text-left ${chip(d.damage_signs.includes(x))}`}>{x}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input required value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" className={inputBase} autoComplete="name" />
        <input required type="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone" className={inputBase} autoComplete="tel" />
      </div>
      <input type="email" value={d.email} onChange={(e) => set("email", e.target.value)} placeholder="Email (so we can send your details)" className={inputBase} autoComplete="email" />
      <button type="submit" disabled={saving || !id} className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-extrabold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60">
        {saving ? "Saving…" : "Continue →"}
      </button>
      <Disclaimer />
    </form>
  );
}
