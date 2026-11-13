"use client";

import type { HouseFacts, Street } from "@/lib/coach/doors";

export type { HouseFacts, Street };
export type DoorRef = { lat: number; lon: number; address: string };

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function niceDate(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${MON[m - 1]} ${d}, ${y}`;
}

/** Read a newline-delimited JSON stream, one event at a time. */
export async function readNdjson(res: Response, on: (e: Record<string, unknown>) => void) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) {
        try {
          on(JSON.parse(line));
        } catch {
          /* skip a bad line */
        }
      }
    }
  }
}

export function Icon({ name, className = "h-5 w-5" }: { name: "mic" | "send" | "speaker" | "mute" | "search" | "pin" | "check" | "x" | "door"; className?: string }) {
  const d: Record<string, string> = {
    mic: "M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zM19 11a7 7 0 01-14 0M12 18v3",
    send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
    speaker: "M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14",
    mute: "M11 5L6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6",
    search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
    pin: "M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
    check: "M5 12l5 5L20 7",
    x: "M6 6l12 12M18 6L6 18",
    door: "M5 21V4a1 1 0 011-1h12a1 1 0 011 1v17M3 21h18M15 12h.01",
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d[name]} />
    </svg>
  );
}

/** What we know about the house, the way a rep reads it before walking up. */
export function FactsCard({ h, compact }: { h: HouseFacts; compact?: boolean }) {
  const hail = h.hail_in ? `${h.hail_in.toFixed(1)}″ hail reported` : "No 1″+ hail on record";
  if (compact) {
    return (
      <p className="text-xs text-gray-600">
        <span className="font-semibold text-[#0b0e13]">{hail}</span>
        {h.hail_in && h.hail_date ? ` ${niceDate(h.hail_date)}` : ""}
        {h.year_built ? ` · built ${h.year_built}` : ""}
      </p>
    );
  }
  const rows: Array<[string, string]> = [];
  if (h.storms.length > 1) rows.push(["Storms since the roof", h.storms.map(niceDate).join(", ")]);
  if (h.wind) rows.push(["Wind", h.wind]);
  if (h.year_built) rows.push(["Built", `${h.year_built}${h.roof_may_be_original ? ", roof may be original" : ""}`]);
  if (h.permit_date) rows.push(["Dallas roof permit", `${niceDate(h.permit_date)}${h.recent_permit ? " (likely already replaced)" : ""}`]);
  if (h.claim_window) rows.push(["Claim window", h.claim_window]);
  rows.push(["Our history", h.history ?? "Not knocked yet"]);
  return (
    <div className="rounded-xl border border-[#e3e6ea] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-display text-lg font-bold text-[#0b0e13]">
          {hail}
          {h.hail_in && h.hail_date ? <span className="font-normal text-gray-600"> on {niceDate(h.hail_date)}</span> : null}
        </div>
        {h.priority ? <span className="rounded-full bg-[#0b0e13] px-2 py-0.5 text-[11px] font-bold text-[#7FFBAE]">Priority</span> : null}
      </div>
      <dl className="mt-2 space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-2">
            <dt className="text-gray-500">{k}</dt>
            <dd className="text-[#0b0e13]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
