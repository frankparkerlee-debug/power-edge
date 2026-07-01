"use client";

import { useState } from "react";
import { SmsConsent } from "./SmsConsent";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { leadContext } from "@/lib/leadContext";
import { track } from "@/lib/analytics";
import { StormReport, type StormData } from "./StormReport";

/**
 * Storm/hail check lead magnet. Enter an address -> real reported hail activity
 * nearby (NWS data via /api/storm-check) -> book a free inspection. Honest
 * framing throughout: "reported near you," never "your roof is damaged."
 */

type Result = StormData & {
  ok: boolean;
  found?: boolean;
  soft?: boolean;
};

type Phase = "input" | "result";
type Sub = "idle" | "submitting" | "done" | "error";

export function StormCheck() {
  const [address, setAddress] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sub, setSub] = useState<Sub>("idle");

  async function runCheck(addr: string) {
    if (!addr.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/storm-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      const data = (await res.json()) as Result;
      setResult(data);
    } catch {
      setResult({ ok: true, soft: true });
    } finally {
      setLoading(false);
      setPhase("result");
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSub("submitting");
    const form = e.currentTarget;
    const fd = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const summary =
      result?.found && result.count
        ? `${result.count} hail reports within ${result.radiusMi}mi; largest ${result.largest?.size}in on ${result.largest?.date}`
        : "no auto data / soft result";
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.name,
          phone: fd.phone,
          email: fd.email,
          zip: fd.zip,
          service: fd.solar
            ? "Storm inspection (roof + solar)"
            : "Storm inspection (hail check)",
          solar: fd.solar ? "yes" : "",
          message: `[Storm Check] address: ${result?.matched || address} — ${summary}`,
          company_website: fd.company_website,
          ...leadContext({ tool: "storm-check" }),
        }),
      });
      if (!res.ok) throw new Error();
      track("lead_submit", { form: "storm_check", solar: fd.solar ? "yes" : "no" });
      setSub("done");
      form.reset();
    } catch {
      setSub("error");
    }
  }

  const inputBase =
    "w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";

  // ---- Input phase --------------------------------------------------------
  if (phase === "input") {
    return (
      <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
        <h2 className="font-display text-2xl font-bold text-fg-inv">
          Check your address for hail
        </h2>
        <p className="mt-2 text-sm text-fg-inv-dim">
          We&apos;ll pull reported hail activity near your home from National
          Weather Service storm data — free, instant, no obligation.
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
            {loading ? "Scanning NWS storm data…" : "Check my address"}
          </button>
        </form>
        <p className="mt-3 text-center text-xs text-fg-inv-dim">
          Data from NWS / NOAA storm reports. Hail near you doesn&apos;t
          guarantee roof damage — an inspection confirms it.
        </p>
      </div>
    );
  }

  // ---- Result phase -------------------------------------------------------
  const found = result?.found && (result.count ?? 0) > 0;

  return (
    <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-8">
      {sub !== "done" && (
        <>
          {found ? (
            <StormReport data={result!} />
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold leading-tight text-fg-inv sm:text-3xl">
                Let&apos;s get eyes on your roof.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-fg-inv-dim">
                {result?.matched
                  ? "We didn't find major hail reports right at your address in our recent data — but reports are sparse, and North Texas gets hit often. "
                  : "We couldn't auto-pull storm history for that address — but North Texas gets hit often. "}
                A free inspection is the only way to know for sure if your roof
                has storm damage worth claiming.
              </p>
            </>
          )}

          <div className="my-6 h-px w-full bg-line" />

          <p className="mb-4 font-display text-lg font-bold text-fg-inv">
            Book your free storm inspection
          </p>
          <form id="crf-storm" data-cr-capture onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" required placeholder="Full name" className={inputBase} autoComplete="name" />
              <input name="phone" required type="tel" placeholder="Phone" className={inputBase} autoComplete="tel" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="email" type="email" placeholder="Email (we'll send your details)" className={inputBase} autoComplete="email" />
              <input name="zip" placeholder="ZIP code" className={inputBase} inputMode="numeric" autoComplete="postal-code" />
            </div>
            <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line bg-ink px-4 py-3 text-sm text-fg-inv">
              <input
                type="checkbox"
                name="solar"
                value="yes"
                className="h-4 w-4 accent-bolt"
              />
              I have solar panels — check those for hail damage too
            </label>
            <button
              type="submit"
              disabled={sub === "submitting"}
              className="w-full rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
            >
              {sub === "submitting" ? "Sending…" : "Book my free inspection"}
            </button>
            {sub === "error" && (
              <p className="text-sm text-ember">
                Something went wrong — please call us instead.
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setPhase("input");
                setResult(null);
              }}
              className="w-full text-center text-xs text-fg-inv-dim hover:text-fg-inv"
            >
              ← Check a different address
            </button>
            <SmsConsent />
          </form>
        </>
      )}

      {sub === "done" && (
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
            We&apos;ll call you fast to schedule your free storm inspection.
          </p>
        </div>
      )}
    </div>
  );
}
