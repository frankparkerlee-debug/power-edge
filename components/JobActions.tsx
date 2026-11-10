"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookAtDoor } from "./BookAtDoor";

/**
 * What a closer does from a job, in the order they do it.
 *
 * The job page used to offer "Book inspection" as a link to the public
 * homeowner form, never showed when the inspection was or who had it, and had
 * no way to record what the inspection found. So the visit left no trace, and
 * the written assessment promised in every booking confirmation had nowhere to
 * come from.
 *
 * Now the page shows the inspection with directions, and the closer records
 * the outcome in one step. Recording it moves the job and sends the homeowner
 * their assessment, either way.
 */

export type Inspection = {
  when: string;
  closer: string | null;
  status: string;
} | null;

export function JobActions({
  job,
  inspection,
  canSell,
}: {
  job: {
    id: string;
    stage: string;
    address: string;
    owner_name: string | null;
    phone: string | null;
    email: string | null;
    squares: number | null;
  };
  inspection: Inspection;
  canSell: boolean;
}) {
  const router = useRouter();
  const [booking, setBooking] = useState(false);
  const [verdict, setVerdict] = useState<"" | "qualifies" | "fine" | "no_show">("");
  const [findings, setFindings] = useState("");
  const [squares, setSquares] = useState(job.squares ? String(job.squares) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const map = `https://maps.google.com/?q=${encodeURIComponent(job.address)}`;
  const awaitingInspection =
    job.stage === "inspection_booked" || (!!inspection && inspection.status === "booked");
  const preInspection = ["new", "contacted"].includes(job.stage);

  async function record() {
    if (!verdict) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, findings, squares }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setMsg(d.error || "Could not save that.");
        return;
      }
      if (verdict === "no_show") {
        setMsg("Recorded. The job is back to Contacted so it can be rebooked.");
      } else {
        setMsg(
          d.emailed
            ? "Recorded, and the homeowner has their written assessment."
            : job.email
              ? "Recorded, but the assessment email did not go. Tell them before you leave."
              : "Recorded. There is no email on file, so tell them what you found.",
        );
      }
      router.refresh();
    } catch {
      setMsg("No signal. Nothing saved, try again.");
    } finally {
      setBusy(false);
    }
  }

  const btn = (v: typeof verdict, label: string, sub: string) => (
    <button
      type="button"
      onClick={() => setVerdict(v)}
      className={`rounded-lg border p-3 text-left ${
        verdict === v ? "border-[#0c7a40] bg-[#f0fbf4]" : "border-[#d7dbe0] bg-white"
      }`}
    >
      <span className="block font-display font-bold text-[#0b0e13]">{label}</span>
      <span className="block text-xs text-gray-600">{sub}</span>
    </button>
  );

  return (
    <div className="mt-4 space-y-4">
      {/* The inspection, and how to get there. */}
      {inspection ? (
        <div className="rounded-lg border border-[#e3e6ea] bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Inspection
              </div>
              <div className="mt-0.5 font-display text-lg font-bold text-[#0b0e13]">
                {inspection.when}
              </div>
              <div className="text-sm text-gray-600">
                {inspection.closer ? `with ${inspection.closer}` : "No closer assigned yet"}
                {inspection.status !== "booked" ? ` · ${inspection.status.replace(/_/g, " ")}` : ""}
              </div>
            </div>
            <a
              href={map}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[#0c7a40] px-3 py-2 text-sm font-bold text-[#0c7a40]"
            >
              Directions
            </a>
          </div>
        </div>
      ) : preInspection ? (
        <button
          type="button"
          onClick={() => setBooking(true)}
          className="w-full rounded-lg border-2 border-dashed border-[#0c7a40] bg-white py-3 font-bold text-[#0c7a40]"
        >
          Book the inspection
        </button>
      ) : null}

      {/* What the inspection found. Closers only: a setter recording a verdict
          would be telling a homeowner about a roof they never looked at. */}
      {canSell && awaitingInspection ? (
        <div className="rounded-lg border-2 border-[#0b0e13] bg-white p-4">
          <div className="font-display text-lg font-bold text-[#0b0e13]">What did you find?</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {btn("qualifies", "Storm damage", "Moves to Inspected, then price it")}
            {btn("fine", "Roof is fine", "They get it in writing. That's the promise.")}
            {btn("no_show", "Didn't happen", "Nobody home or postponed")}
          </div>

          {verdict && verdict !== "no_show" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem]">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor="ja-findings">
                  What you saw (goes to the homeowner)
                </label>
                <textarea
                  id="ja-findings"
                  rows={3}
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder={
                    verdict === "fine"
                      ? "Shingles intact, no bruising, normal wear for age"
                      : "Hail bruising on the south and west slopes, 9 hits per test square, dented vents"
                  }
                  className="w-full resize-y rounded-md border border-[#d7dbe0] px-3 py-2.5 text-[16px] focus:border-[#0c7a40] focus:outline-none"
                />
              </div>
              {verdict === "qualifies" ? (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor="ja-sq">
                    Squares
                  </label>
                  <input
                    id="ja-sq"
                    inputMode="decimal"
                    value={squares}
                    onChange={(e) => setSquares(e.target.value)}
                    placeholder="32"
                    className="w-full rounded-md border border-[#d7dbe0] px-3 py-2.5 text-[16px] focus:border-[#0c7a40] focus:outline-none"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {verdict ? (
            <button
              type="button"
              onClick={record}
              disabled={busy}
              className="mt-3 w-full rounded-lg bg-[#0c7a40] py-3 font-display font-bold text-white disabled:opacity-40"
            >
              {busy
                ? "Saving..."
                : verdict === "fine"
                  ? "Record it and send their assessment"
                  : verdict === "qualifies"
                    ? "Record it and send what we found"
                    : "Record it"}
            </button>
          ) : null}
        </div>
      ) : null}

      {msg ? <p className="text-sm font-semibold text-[#0b0e13]">{msg}</p> : null}

      {booking ? (
        <BookAtDoor
          door={{ id: "", address: job.address }}
          jobId={job.id}
          prefill={{
            name: job.owner_name || "",
            phone: job.phone || "",
            email: job.email || "",
          }}
          onClose={() => setBooking(false)}
          onBooked={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
