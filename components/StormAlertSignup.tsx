"use client";

import { useRef, useState } from "react";
import { CONSENT_TEXT } from "@/lib/stormConsent";

/**
 * Storm-alert signup. The consent shown here is the exact text the API stores,
 * and the homeowner signs by checking the box and typing their name.
 */
export default function StormAlertSignup({
  initialAddress,
  lat,
  lon,
  targetId,
}: {
  initialAddress: string;
  lat: string;
  lon: string;
  targetId: string;
}) {
  const started = useRef(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState(initialAddress);
  const [agree, setAgree] = useState(false);
  const [signature, setSignature] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const markStart = () => {
    if (!started.current) started.current = Date.now();
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("sending");
    setError("");
    const hp = (e.currentTarget.elements.namedItem("company_website") as HTMLInputElement | null)?.value ?? "";
    try {
      const res = await fetch("/api/storm-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone, email, address, agree, signature,
          lat, lon, target_id: targetId,
          company_website: hp,
          form_elapsed_ms: started.current ? Date.now() - started.current : 0,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't sign you up. Try again.");
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="rounded-card border border-bolt/40 bg-bolt/10 p-6">
        <p className="font-display text-xl font-bold text-fg-inv">You&apos;re signed up.</p>
        <p className="mt-2 text-fg-inv-dim">
          We&apos;ll text you only when a hail or tornado warning covers {address}. Reply STOP to any
          text to opt out.
        </p>
      </div>
    );
  }

  const input =
    "w-full rounded-md border border-line bg-ink-2 px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";

  return (
    <form onSubmit={submit} onFocus={markStart} className="space-y-4">
      <input className={input} placeholder="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input className={input} placeholder="Mobile number" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      <input className={input} placeholder="Home address" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} required />
      <input className={input} placeholder="Email (optional)" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />

      <input type="text" name="company_website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line px-4 py-3">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-bolt" />
        <span className="text-[13px] leading-relaxed text-fg-inv-dim">{CONSENT_TEXT}</span>
      </label>
      <input
        className={input}
        placeholder="Type your full name to sign"
        value={signature}
        onChange={(e) => setSignature(e.target.value)}
        required
      />

      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
      >
        {state === "sending" ? "Signing you up…" : "Sign me up"}
      </button>
      {state === "error" && <p className="text-sm text-ember">{error}</p>}
    </form>
  );
}
