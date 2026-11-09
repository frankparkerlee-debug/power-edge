"use client";

import { useEffect, useState } from "react";

/**
 * Real inspection booking. Replaces "type when you're free and wait for a
 * callback" with a homeowner picking an actual two-hour arrival window.
 *
 * Deliberately two steps: pick the window first, then give contact details.
 * Choosing a time is a small, low-friction commitment that makes the second
 * step feel like confirming something you already decided.
 */

type Slot = { start: string; timeLabel: string };
type Day = { date: string; dayLabel: string; slots: Slot[] };

export function BookInspection({
  source = "web",
  claimIntakeId,
  prefill,
  onBooked,
  initialDays,
}: {
  source?: string;
  claimIntakeId?: string;
  prefill?: { name?: string; phone?: string; email?: string; address?: string };
  onBooked?: () => void;
  /** Server-rendered slots. Without these the picker shows a loading box,
   *  which on a phone in a driveway is just an empty card. */
  initialDays?: Day[];
}) {
  const [days, setDays] = useState<Day[] | null>(initialDays ?? null);
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({
    name: prefill?.name || "",
    phone: prefill?.phone || "",
    email: prefill?.email || "",
    address: prefill?.address || "",
    notes: "",
    company_website: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ dayLabel: string; timeLabel: string } | null>(null);

  useEffect(() => {
    // Refresh in the background even when the server gave us slots: the page
    // may have been cached, and a stale window is worse than a slow one.
    let live = true;
    fetch("/api/appointments")
      .then((r) => r.json())
      .then((d) => { if (live) setDays(d.days || []); })
      .catch(() => { if (live && !initialDays) setDays([]); });
    return () => { live = false; };
  }, [initialDays]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slot_start: slot.start, source, claim_intake_id: claimIntakeId }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "Something went wrong. Call us and we'll book it by hand.");
        // Slot was taken out from under them: refresh what's open.
        if (res.status === 409) {
          setSlot(null);
          fetch("/api/appointments").then((r) => r.json()).then((x) => setDays(x.days || []));
        }
        return;
      }
      setDone(d.slot);
      onBooked?.();
    } catch {
      setError("Network hiccup. Call us and we'll book it by hand.");
    } finally {
      setBusy(false);
    }
  }

  const inputBase =
    "w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv placeholder:text-fg-inv-dim/60 focus:border-bolt focus:outline-none";
  const lbl = "block text-sm font-semibold text-fg-inv";

  if (done) {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bolt">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-ink"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" /></svg>
        </div>
        <h3 className="font-display text-2xl font-bold text-fg-inv">You&apos;re booked.</h3>
        <p className="mt-2 text-fg-inv-dim">
          <strong className="text-fg-inv">{done.dayLabel}</strong>, {done.timeLabel}. That&apos;s an
          arrival window, so we&apos;ll call before we head over.
        </p>
        <p className="mt-4 text-sm text-fg-inv-dim">
          Check your email for the confirmation. Need to move it? Call or text us.
        </p>
      </div>
    );
  }

  if (days === null) {
    return <p className="py-6 text-center text-sm text-fg-inv-dim">Loading open times…</p>;
  }

  if (days.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-fg-inv-dim">
        We&apos;re fully booked online right now. Call us and we&apos;ll find you a window.
      </p>
    );
  }

  const day = days[Math.min(dayIdx, days.length - 1)];

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Day strip */}
      <div>
        <span className={lbl}>Pick a day</span>
        <div className="mt-2 flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1">
          {days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              onClick={() => { setDayIdx(i); setSlot(null); }}
              className={`shrink-0 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                i === dayIdx
                  ? "border-bolt bg-bolt/10 text-bolt"
                  : "border-line text-fg-inv-dim hover:border-bolt"
              }`}
            >
              {d.dayLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Window picker */}
      <div>
        <span className={lbl}>Pick an arrival window</span>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {day.slots.map((s) => (
            <button
              key={s.start}
              type="button"
              onClick={() => setSlot(s)}
              className={`rounded-md border px-3 py-3 text-sm font-semibold transition-colors ${
                slot?.start === s.start
                  ? "border-bolt bg-bolt/10 text-bolt"
                  : "border-line text-fg-inv-dim hover:border-bolt"
              }`}
            >
              {s.timeLabel}
            </button>
          ))}
        </div>
      </div>

      {slot && (
        <div className="space-y-4 border-t border-line pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={lbl} htmlFor="bi-name">Name</label>
              <input id="bi-name" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`mt-1 ${inputBase}`} placeholder="Full name" />
            </div>
            <div>
              <label className={lbl} htmlFor="bi-phone">Phone</label>
              <input id="bi-phone" required type="tel" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={`mt-1 ${inputBase}`} placeholder="(469) 555-0123" />
            </div>
          </div>
          <div>
            <label className={lbl} htmlFor="bi-address">Property address</label>
            <input id="bi-address" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={`mt-1 ${inputBase}`} placeholder="Street, city" />
          </div>
          <div>
            <label className={lbl} htmlFor="bi-email">Email <span className="font-normal text-fg-inv-dim">(for your confirmation)</span></label>
            <input id="bi-email" type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={`mt-1 ${inputBase}`} placeholder="you@email.com" />
          </div>

          {/* Honeypot */}
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off"
            aria-hidden="true" value={form.company_website}
            onChange={(e) => setForm({ ...form, company_website: e.target.value })}
            className="absolute left-[-9999px] h-0 w-0 opacity-0" />

          {error && <p className="text-sm font-semibold text-red-400">{error}</p>}

          <button type="submit" disabled={busy}
            className="w-full rounded-md bg-bolt px-6 py-4 font-display text-lg font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60">
            {busy ? "Booking…" : `Book ${day.dayLabel}, ${slot.timeLabel}`}
          </button>
          <p className="text-center text-xs leading-relaxed text-fg-inv-dim">
            Free inspection, no obligation. If your roof is fine, we tell you that in writing.
            Booking accepts our{" "}
            <a href="/agreement" target="_blank" rel="noopener" className="font-semibold text-bolt underline">
              inspection terms
            </a>
            , which authorize no work and no payment.
          </p>
        </div>
      )}
    </form>
  );
}
