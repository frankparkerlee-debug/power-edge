"use client";

import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      /* the response is deliberately uninformative either way */
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="rounded-card border border-line bg-ink-2 p-5">
        <p className="font-display text-lg font-bold text-fg-inv">Check your email.</p>
        <p className="mt-1.5 text-sm text-fg-inv-dim">
          If <strong className="text-fg-inv">{email}</strong> is on the team, a sign-in
          link is on its way. It works once and expires in 20 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="sr-only" htmlFor="login-email">Work email</label>
      <input
        id="login-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(ev) => setEmail(ev.target.value)}
        placeholder="you@poweredgetx.com"
        className="w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="w-full rounded-md bg-bolt px-6 py-3.5 font-display font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
      >
        {state === "busy" ? "Sending…" : "Send my sign-in link"}
      </button>
    </form>
  );
}
