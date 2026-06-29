"use client";

import { useState } from "react";
import { services } from "@/lib/services";
import { SmsConsent } from "./SmsConsent";
import { leadContext } from "@/lib/leadContext";
import { track } from "@/lib/analytics";

type Status = "idle" | "submitting" | "success" | "error";

export function LeadForm({
  defaultService = "",
  compact = false,
}: {
  defaultService?: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    const form = e.currentTarget;
    const data = {
      ...Object.fromEntries(new FormData(form).entries()),
      ...leadContext(),
    };

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      track("lead_submit", { form: "lead_form", service: String(data.service || "") });
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-card border border-bolt/40 bg-bolt/10 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bolt">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-ink">
            <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
          </svg>
        </div>
        <h3 className="font-display text-2xl font-bold text-fg-inv">
          Got it — we&apos;ll be in touch fast.
        </h3>
        <p className="mt-2 text-fg-inv-dim">
          A real person from our team will call you, usually within the hour
          during business hours.
        </p>
      </div>
    );
  }

  const inputBase =
    "w-full rounded-md border border-line bg-ink-2 px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className={compact ? "" : "grid gap-4 sm:grid-cols-2"}>
        <input
          name="name"
          required
          placeholder="Full name"
          className={inputBase}
          autoComplete="name"
        />
        <input
          name="phone"
          required
          type="tel"
          placeholder="Phone number"
          className={inputBase}
          autoComplete="tel"
        />
      </div>
      <div className={compact ? "" : "grid gap-4 sm:grid-cols-2"}>
        <input
          name="email"
          type="email"
          placeholder="Email (optional)"
          className={inputBase}
          autoComplete="email"
        />
        <input
          name="zip"
          placeholder="ZIP code"
          className={inputBase}
          autoComplete="postal-code"
          inputMode="numeric"
        />
      </div>
      <select name="service" defaultValue={defaultService} className={inputBase} required>
        <option value="" disabled>
          What do you need?
        </option>
        {services.map((s) => (
          <option key={s.slug} value={s.short}>
            {s.title}
          </option>
        ))}
        <option value="Storm / insurance claim">Storm / insurance claim</option>
        <option value="Emergency">Emergency — need someone now</option>
        <option value="Other">Something else</option>
      </select>
      <textarea
        name="message"
        rows={compact ? 2 : 3}
        placeholder="Briefly, what's going on? (optional)"
        className={inputBase}
      />

      {/* Honeypot — hidden from humans, bots fill it */}
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Get my free quote"}
      </button>

      {status === "error" && (
        <p className="text-sm text-ember">
          {error}. Or just call us at any time.
        </p>
      )}
      <p className="text-center text-xs text-fg-inv-dim">
        No spam, no door-knock pressure. We respond fast.
      </p>
      <SmsConsent />
    </form>
  );
}
