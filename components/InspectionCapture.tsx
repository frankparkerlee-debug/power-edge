"use client";

import { useState } from "react";
import { BookInspection } from "@/components/BookInspection";
import { LeadForm } from "@/components/LeadForm";

/**
 * Two ways onto the schedule. Booking a real window is the default because it
 * closes the loop on the spot; the callback form stays for people who'd rather
 * talk to a person first. Keeping both behind one visible choice avoids the
 * usual mistake of burying the self-serve path under a contact form.
 */
type Day = { date: string; dayLabel: string; slots: { start: string; timeLabel: string }[] };

export function InspectionCapture({
  source = "free-inspection",
  initialDays,
}: {
  source?: string;
  initialDays?: Day[];
}) {
  const [mode, setMode] = useState<"book" | "call">("book");

  const tab = (on: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
      on ? "bg-bolt text-ink" : "text-fg-inv-dim hover:text-fg-inv"
    }`;

  return (
    <div>
      <div className="mb-5 flex gap-1 rounded-lg border border-line bg-ink p-1">
        <button type="button" onClick={() => setMode("book")} className={tab(mode === "book")}>
          Pick my time
        </button>
        <button type="button" onClick={() => setMode("call")} className={tab(mode === "call")}>
          Just call me
        </button>
      </div>

      {mode === "book" ? (
        <BookInspection source={source} initialDays={initialDays} />
      ) : (
        <LeadForm compact defaultService="Free roof inspection" />
      )}
    </div>
  );
}
