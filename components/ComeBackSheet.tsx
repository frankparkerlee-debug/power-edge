"use client";

import { useMemo, useState } from "react";

/**
 * "Come back", with a when.
 *
 * It used to record the outcome and nothing else: someone said try later, and
 * no later was attached and no list would ever show it again. A come-back that
 * does not resurface is an appointment that never happens. The setter picks
 * when they promised to return, and it lands on their Today list at that time.
 */

type Door = { id: string; address: string; owner_name?: string };

/** Chicago's UTC offset at a given instant, as "-06:00" or "-05:00". */
function chicagoOffset(d: Date) {
  const tz =
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", timeZoneName: "shortOffset" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-6";
  const h = Number(tz.replace("GMT", "")) || -6;
  return `${h < 0 ? "-" : "+"}${String(Math.abs(h)).padStart(2, "0")}:00`;
}

/**
 * A wall-clock time in the zone the crew works in, regardless of the phone.
 *
 * The offset is looked up for that date rather than hardcoded. A fixed -06:00
 * is right in winter and an hour late all summer, which is the same class of
 * timezone slip that put cancellation deadlines a day early on this project.
 */
function at(daysAhead: number, hour: number) {
  const day = new Date(Date.now() + daysAhead * 86400000);
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(day);
  const hh = String(hour).padStart(2, "0");
  // Probe noon that day for the offset, so a DST switch overnight is honored.
  const off = chicagoOffset(new Date(`${ymd}T12:00:00-06:00`));
  return new Date(`${ymd}T${hh}:00:00${off}`);
}

/** Days until Saturday, counted in Chicago, not the phone's zone. */
function nextSaturday() {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short" })
    .format(new Date());
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return (6 - dow + 7) % 7 || 7;
}

export function ComeBackSheet({
  door,
  onClose,
  onSaved,
}: {
  door: Door;
  onClose: () => void;
  onSaved: () => void;
}) {
  const options = useMemo(
    () => [
      { key: "tonight", label: "This evening", when: at(0, 17) },
      { key: "tomorrow", label: "Tomorrow", when: at(1, 17) },
      { key: "weekend", label: "Saturday", when: at(nextSaturday(), 10) },
      { key: "week", label: "Next week", when: at(7, 17) },
    ],
    [],
  );
  const [pick, setPick] = useState(options[0].key);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const chosen = options.find((o) => o.key === pick)!;
    try {
      const res = await fetch("/api/admin/knock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_id: door.id,
          outcome: "come_back",
          note: note.trim(),
          follow_up_at: chosen.when.toISOString(),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onSaved();
      onClose();
    } catch {
      setError("Did not save. No signal? Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-[#0b0e13] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-extrabold">Come back when?</h2>
            <p className="mt-0.5 text-sm text-gray-600">{door.address}</p>
          </div>
          <button onClick={onClose} className="text-sm font-semibold text-gray-500 underline">
            Cancel
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => setPick(o.key)}
              className={`rounded-lg border py-3 text-[15px] font-bold ${
                pick === o.key
                  ? "border-[#0c7a40] bg-[#f0fbf4] text-[#0c7a40]"
                  : "border-[#d7dbe0] bg-white"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <label className="mt-4 mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor="cb-note">
          What did they say?
        </label>
        <textarea
          id="cb-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Husband home after 6, wants to see the roof first"
          className="w-full resize-y rounded-lg border border-[#d7dbe0] px-3 py-3 text-[16px] focus:border-[#0c7a40] focus:outline-none"
        />

        {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

        <button
          onClick={save}
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-[#0c7a40] py-3.5 font-display text-base font-bold text-white disabled:opacity-40"
        >
          {busy ? "Saving..." : "Put it on my list"}
        </button>
      </div>
    </div>
  );
}
