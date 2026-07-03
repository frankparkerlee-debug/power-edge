"use client";

import { useRef, useState } from "react";
import { SmsConsent } from "./SmsConsent";
import { leadContext } from "@/lib/leadContext";
import { track } from "@/lib/analytics";

/**
 * Financing pre-qualification.
 *
 * Primary path: connect the bank via Plaid (sandbox) — we verify identity +
 * balances instantly and return a structure-based decision (no credit pull).
 * Fallback path: submit without connecting -> captured as a lead for manual
 * follow-up. Consent-gated. No SSN/DOB collected here.
 *
 * Plaid is env-gated server-side (PLAID_CLIENT_ID/SECRET); if it's not set, the
 * connect button simply falls back to the capture form.
 */

const AMOUNTS = ["$1,000", "$2,500", "$5,000", "$8,000", "$10,000", "$15,000+"];
type Sub = "idle" | "submitting" | "done" | "error";
type Plaid =
  | "idle"
  | "loading"
  | "connecting"
  | "deciding"
  | "approved"
  | "review"
  | "error";

const inputBase =
  "w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";

function loadPlaid(): Promise<{ create: (o: unknown) => { open: () => void } }> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { Plaid?: never };
    if (w.Plaid) return resolve(w.Plaid);
    const s = document.createElement("script");
    s.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    s.onload = () =>
      resolve((window as unknown as { Plaid: never }).Plaid);
    s.onerror = () => reject(new Error("Plaid script failed"));
    document.body.appendChild(s);
  });
}

export function FinancingPrequal() {
  const formRef = useRef<HTMLFormElement>(null);
  const [amount, setAmount] = useState("$5,000");
  const [consent, setConsent] = useState(false);
  const [sub, setSub] = useState<Sub>("idle");
  const [plaid, setPlaid] = useState<Plaid>("idle");
  const [msg, setMsg] = useState("");

  function readForm() {
    const form = formRef.current;
    if (!form) return null;
    return Object.fromEntries(new FormData(form).entries()) as Record<
      string,
      string
    >;
  }

  async function connectBank() {
    const fd = readForm();
    if (!fd || !fd.name || !fd.phone || !fd.email || !consent) {
      setPlaid("error");
      setMsg("Add your name, phone, and email, and check the box first.");
      return;
    }
    setPlaid("loading");
    setMsg("");
    try {
      const ltRes = await fetch("/api/plaid/link-token", { method: "POST" });
      if (!ltRes.ok) throw new Error("unavailable");
      const { link_token } = await ltRes.json();
      const PlaidJs = await loadPlaid();
      const handler = PlaidJs.create({
        token: link_token,
        onSuccess: async (public_token: string) => {
          setPlaid("deciding");
          try {
            const res = await fetch("/api/plaid/underwrite", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                public_token,
                ...fd,
                amount,
                ...leadContext({ tool: "financing-prequal" }),
              }),
            }).then((r) => r.json());
            track("financing_prequal_plaid", {
              decision: res.decision || "error",
            });
            setMsg(res.message || "");
            setPlaid(res.decision === "approved" ? "approved" : "review");
          } catch {
            setPlaid("error");
            setMsg("Something went wrong — please call us instead.");
          }
        },
        onExit: () => setPlaid((s) => (s === "connecting" ? "idle" : s)),
      });
      setPlaid("connecting");
      handler.open();
    } catch {
      setPlaid("error");
      setMsg(
        "Instant bank connect isn't available right now — submit below and we'll reach out.",
      );
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) return;
    setSub("submitting");
    const fd = readForm()!;
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.name,
          phone: fd.phone,
          email: fd.email,
          address: fd.address,
          zip: fd.zip,
          service: "Financing pre-qualification",
          message: `[Financing Prequal] amount: ${amount}`,
          company_website: fd.company_website,
          ...leadContext({ tool: "financing-prequal" }),
        }),
      });
      if (!res.ok) throw new Error();
      track("lead_submit", { form: "financing_prequal" });
      setSub("done");
    } catch {
      setSub("error");
    }
  }

  // ---- Decision / done states --------------------------------------------
  if (plaid === "approved" || plaid === "review") {
    const good = plaid === "approved";
    return (
      <div
        className={`rounded-card border p-8 text-center ${
          good ? "border-bolt/50 bg-bolt/10" : "border-line bg-ink-2"
        }`}
      >
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            good ? "bg-bolt" : "bg-steel"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-ink">
            <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
          </svg>
        </div>
        <h3 className="font-display text-2xl font-bold text-fg-inv">
          {good ? "You're pre-approved." : "You're all set."}
        </h3>
        <p className="mt-2 text-fg-inv-dim">{msg}</p>
        <p className="mt-3 text-xs text-fg-inv-dim">
          No credit impact. Final terms are provided in writing before you sign;
          you always pay your full deductible.
        </p>
      </div>
    );
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
        </p>
      </div>
    );
  }

  const busy = plaid === "loading" || plaid === "connecting" || plaid === "deciding";

  return (
    <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
      <h2 className="font-display text-2xl font-bold text-fg-inv">
        Pre-qualify in 60 seconds
      </h2>
      <p className="mt-1.5 text-sm text-fg-inv-dim">
        Connect your bank securely and get an instant decision —{" "}
        <strong className="text-fg-inv">no credit check, no SSN, no impact
        to your score.</strong>
      </p>

      <form ref={formRef} onSubmit={submit} className="mt-6 space-y-3" data-cr-capture id="crf-prequal">
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
            I authorize PowerEdge to contact me and to securely verify my bank
            and balances to pre-qualify me. This is{" "}
            <strong className="text-fg-inv">not a credit check</strong> and
            won&apos;t affect my score. Final terms are provided in writing
            before I sign; I always pay my full deductible.
          </span>
        </label>

        {plaid === "error" && msg && (
          <p className="text-sm text-ember">{msg}</p>
        )}

        <button
          type="button"
          onClick={connectBank}
          disabled={busy || !consent}
          className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-50"
        >
          {plaid === "loading"
            ? "Starting secure connect…"
            : plaid === "connecting"
              ? "Connecting your bank…"
              : plaid === "deciding"
                ? "Checking…"
                : "Connect bank — instant decision"}
        </button>

        <button
          type="submit"
          disabled={sub === "submitting" || !consent}
          className="w-full text-center text-xs font-semibold text-fg-inv-dim underline-offset-2 hover:text-fg-inv hover:underline disabled:opacity-50"
        >
          {sub === "submitting"
            ? "Sending…"
            : "Prefer a call? Submit without connecting"}
        </button>
        {sub === "error" && (
          <p className="text-sm text-ember">Something went wrong — please call us.</p>
        )}
        <SmsConsent />
      </form>
    </div>
  );
}
