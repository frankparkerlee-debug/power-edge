"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * Inline address capture for the homepage claim-check band. Starting the tool
 * on the homepage (rather than a link) cuts a step; the address is handed to
 * /roof-claim-check via ?a= and the tool auto-runs the hail lookup on arrival.
 */
export function ClaimCheckInline() {
  const [addr, setAddr] = useState("");
  const router = useRouter();

  function go(e: React.FormEvent) {
    e.preventDefault();
    track("claim_check_start", { from: "home_band" });
    const a = addr.trim();
    router.push(`/roof-claim-check${a ? `?a=${encodeURIComponent(a)}` : ""}`);
  }

  return (
    <form onSubmit={go} className="mt-7">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="Enter your address"
          autoComplete="street-address"
          className="w-full rounded-md border border-line bg-ink px-4 py-3.5 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-bolt px-6 py-3.5 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi"
        >
          Check my roof →
        </button>
      </div>
      <p className="mt-3 text-sm text-fg-inv-dim">
        Free · 60 seconds · no obligation. Approved?{" "}
        <span className="font-semibold text-bolt">
          Start for as little as $500 down.
        </span>
      </p>
    </form>
  );
}
