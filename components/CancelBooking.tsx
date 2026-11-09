"use client";

import { useState } from "react";

/** Cancel is a two-tap action on purpose: one stray tap on a phone should not
 *  drop an appointment a crew is planning around. */
export function CancelBooking({ id }: { id: string }) {
  const [stage, setStage] = useState<"idle" | "confirm" | "working" | "done" | "error">("idle");

  async function cancel() {
    setStage("working");
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      const d = await res.json();
      setStage(res.ok && d.ok ? "done" : "error");
    } catch {
      setStage("error");
    }
  }

  if (stage === "done") {
    return (
      <p className="mt-6 rounded-card border border-line bg-ink-2 p-5 text-fg-inv">
        Cancelled. That window is free again, and nobody will come out.
      </p>
    );
  }

  return (
    <div className="mt-6">
      {stage === "idle" && (
        <button
          onClick={() => setStage("confirm")}
          className="text-sm font-semibold text-fg-inv-dim underline hover:text-fg-inv"
        >
          Cancel this inspection
        </button>
      )}
      {stage === "confirm" && (
        <div className="rounded-card border border-line bg-ink-2 p-5">
          <p className="text-fg-inv">Cancel this inspection?</p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={cancel}
              className="rounded-md bg-red-600 px-4 py-2.5 font-display font-bold text-white"
            >
              Yes, cancel it
            </button>
            <button
              onClick={() => setStage("idle")}
              className="rounded-md border border-line px-4 py-2.5 font-display font-bold text-fg-inv"
            >
              Keep it
            </button>
          </div>
        </div>
      )}
      {stage === "working" && <p className="text-sm text-fg-inv-dim">Cancelling…</p>}
      {stage === "error" && (
        <p className="text-sm font-semibold text-red-400">
          That didn&apos;t go through. Call us and we&apos;ll take care of it.
        </p>
      )}
    </div>
  );
}
