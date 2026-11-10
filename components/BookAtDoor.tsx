"use client";

import { useEffect, useState } from "react";
import { AddressAutocomplete } from "./AddressAutocomplete";

/**
 * Booking an inspection at the door, in one sheet.
 *
 * "Appt set" used to record the word and nothing else, so a setter could tap
 * it, shake hands and leave with no inspection on anyone's calendar. This is
 * what opens instead: pick a window that a closer is actually free for,
 * confirm who you spoke to, leave the closer a note, done. The job, the
 * closer assignment, the homeowner's confirmation and the closer's own email
 * all happen behind the one button.
 *
 * Built for a phone held in one hand on a doorstep: big targets, nothing to
 * scroll past, and the window list is the first thing on screen because it is
 * the only thing the homeowner is waiting on.
 */

type Slot = { start: string; end: string; dayLabel: string; timeLabel: string; date: string };
type Day = { date: string; dayLabel: string; slots: Slot[] };

export type DoorForBooking = {
  id: string;
  address: string;
  city?: string;
  zip?: string;
  owner_name?: string;
  phone?: string | null;
};

/** County records read "SHANER, PRISCILLA & AARON". Shown as a hint, not a value. */
function recordName(raw?: string) {
  if (!raw) return "";
  const t = raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const [last, rest] = t.split(",").map((x) => x.trim());
  return rest ? `${rest} ${last}` : t;
}

function fullAddress(d: DoorForBooking) {
  const base = d.address.trim();
  // Some county rows already carry city and ZIP in the address line.
  if (/\b\d{5}\b/.test(base)) return base;
  return [base, d.city, d.zip ? `TX ${d.zip}` : ""].filter(Boolean).join(", ");
}

/**
 * A closer can drive to it. County rows like "5252 N HWY 171 , TX" have no
 * city or ZIP, and Highway 171 runs through several towns, so an inspection
 * booked against that line sends the closer to the wrong place or nowhere.
 */
function hasZip(a: string) {
  return /\b\d{5}\b/.test(a);
}

export function BookAtDoor({
  door,
  jobId,
  prefill,
  onClose,
  onBooked,
}: {
  door: DoorForBooking;
  /** Booking from a job record rather than a door on the map. */
  jobId?: string;
  /** What the job already knows about the homeowner. */
  prefill?: { name?: string; phone?: string; email?: string };
  onClose: () => void;
  onBooked: (r: { jobId: string | null; when: string; closer: string | null }) => void;
}) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<Slot | null>(null);

  const [name, setName] = useState(prefill?.name || "");
  const [phone, setPhone] = useState(prefill?.phone || door.phone || "");
  const [email, setEmail] = useState(prefill?.email || "");
  const [note, setNote] = useState("");
  // The setter is standing at the house, so they can fix a county address
  // that is missing its city or ZIP before a closer is sent to it.
  const [addr, setAddr] = useState(fullAddress(door));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{
    when: string;
    closer: string | null;
    jobId: string | null;
    emailed: boolean;
    closerTold: boolean;
  } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/book", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (!d.ok) return setLoadError("Could not load the calendar.");
        setDays(d.days as Day[]);
      })
      .catch(() => live && setLoadError("No signal. Try again in a moment."));
    return () => {
      live = false;
    };
  }, []);

  async function book() {
    setError("");
    if (!slot) return setError("Pick a time.");
    if (name.trim().length < 2) return setError("Who did you talk to?");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return setError("Get a phone number so the closer can confirm.");
    if (!hasZip(addr)) return setError("Add the city and ZIP so the closer can find the house.");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_start: slot.start,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: addr.trim(),
          note: note.trim(),
          target_id: door.id,
          job_id: jobId || "",
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "Could not book that.");
        // Someone else took it while this sheet was open: refresh the windows.
        if (d.code === "taken") {
          setSlot(null);
          fetch("/api/admin/book", { cache: "no-store" })
            .then((r) => r.json())
            .then((x) => x.ok && setDays(x.days));
        }
        return;
      }
      setDone({
        when: d.when,
        closer: d.closer,
        jobId: d.jobId,
        emailed: !!d.emailed,
        closerTold: !!d.closerTold,
      });
      onBooked({ jobId: d.jobId, when: d.when, closer: d.closer });
    } catch {
      setError("No signal. Nothing was booked, try again.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-[#d7dbe0] px-3 py-3 text-[16px] focus:border-[#0c7a40] focus:outline-none";
  const current = days?.[day];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-[#0b0e13] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div>
            <h2 className="font-display text-xl font-extrabold">Booked.</h2>
            <p className="mt-2 text-[15px]">
              <strong>{done.when}</strong>
              {done.closer ? (
                <>
                  {" "}with <strong>{done.closer}</strong>.
                </>
              ) : (
                <>. The office will assign a closer.</>
              )}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-gray-700">
              <li>
                {done.emailed
                  ? "The homeowner has their confirmation by email."
                  : email
                    ? "The confirmation email did not go. Tell them the time before you leave."
                    : "No email given, so tell them the time before you leave."}
              </li>
              {done.closer ? (
                <li>
                  {done.closerTold
                    ? `${done.closer} has been sent the details and your note.`
                    : `${done.closer} could not be emailed. It is on their board.`}
                </li>
              ) : null}
            </ul>
            <div className="mt-5 flex gap-2">
              {done.jobId ? (
                <a
                  href={`/admin/jobs/${done.jobId}`}
                  className="flex-1 rounded-lg border border-[#d7dbe0] py-3 text-center font-bold"
                >
                  Open the job
                </a>
              ) : null}
              <button
                onClick={onClose}
                className="flex-1 rounded-lg bg-[#0c7a40] py-3 font-bold text-white"
              >
                Next door
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-extrabold">Book the inspection</h2>
                <p className="mt-0.5 text-sm text-gray-600">{addr}</p>
              </div>
              <button onClick={onClose} className="text-sm font-semibold text-gray-500 underline">
                Cancel
              </button>
            </div>

            {/* Only when the record cannot be driven to. */}
            {!hasZip(addr) ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-[#0b0e13]">
                  The county record has no city or ZIP. Confirm the address so the closer
                  can find the house.
                </p>
                <AddressAutocomplete
                  value={addr}
                  onChange={setAddr}
                  onSelect={setAddr}
                  placeholder="Street, city, ZIP"
                  className="mt-2 w-full rounded-lg border border-[#d7dbe0] bg-white px-3 py-3 text-[16px] focus:border-[#0c7a40] focus:outline-none"
                />
              </div>
            ) : null}

            {/* When. First, because it is the only thing the homeowner is waiting on. */}
            <div className="mt-4">
              {loadError ? (
                <p className="text-sm font-semibold text-red-600">{loadError}</p>
              ) : !days ? (
                <p className="text-sm text-gray-500">Loading open times...</p>
              ) : days.length === 0 ? (
                <p className="text-sm font-semibold text-[#b54708]">
                  Nothing open in the next two weeks. Take their number and the office will
                  call them with a time.
                </p>
              ) : (
                <>
                  <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    {days.map((d, i) => (
                      <button
                        key={d.date}
                        onClick={() => {
                          setDay(i);
                          setSlot(null);
                        }}
                        className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold ${
                          i === day
                            ? "border-[#0b0e13] bg-[#0b0e13] text-white"
                            : "border-[#d7dbe0] bg-white"
                        }`}
                      >
                        {d.dayLabel}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {current?.slots.map((s) => (
                      <button
                        key={s.start}
                        onClick={() => setSlot(s)}
                        className={`rounded-lg border py-3 text-[15px] font-bold ${
                          slot?.start === s.start
                            ? "border-[#0c7a40] bg-[#f0fbf4] text-[#0c7a40]"
                            : "border-[#d7dbe0] bg-white"
                        }`}
                      >
                        {s.timeLabel}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Who. The person at the door is often not the owner on record. */}
            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor="bd-name">
                  Who did you talk to?
                </label>
                <input
                  id="bd-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First and last name"
                  autoComplete="off"
                  className={input}
                />
                {door.owner_name ? (
                  <p className="mt-1 text-xs text-gray-500">
                    County record: {recordName(door.owner_name)}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor="bd-phone">
                    Phone
                  </label>
                  <input
                    id="bd-phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor="bd-email">
                    Email
                  </label>
                  <input
                    id="bd-email"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="For their confirmation"
                    className={input}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor="bd-note">
                  Note for the closer
                </label>
                <textarea
                  id="bd-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Who decides, gate code, dog, what you saw on the roof"
                  className={`${input} resize-y`}
                />
              </div>
            </div>

            {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

            <button
              onClick={book}
              disabled={busy || !slot}
              className="mt-4 w-full rounded-lg bg-[#0c7a40] py-3.5 font-display text-base font-bold text-white disabled:opacity-40"
            >
              {busy ? "Booking..." : slot ? `Book ${slot.dayLabel}, ${slot.timeLabel}` : "Pick a time"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
