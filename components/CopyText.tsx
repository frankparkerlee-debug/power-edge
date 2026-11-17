"use client";

import { useState } from "react";

/** A block of ready-to-paste text with one Copy button. */
export function CopyText({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-lg border border-[#e3e6ea] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setDone(true);
              setTimeout(() => setDone(false), 2000);
            } catch {
              /* the text is selectable below */
            }
          }}
          className="rounded-md border border-[#0c7a40] px-3 py-1.5 text-sm font-bold text-[#0c7a40]"
        >
          {done ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-[#0b0e13] [overflow-wrap:anywhere]">{text}</p>
    </div>
  );
}
