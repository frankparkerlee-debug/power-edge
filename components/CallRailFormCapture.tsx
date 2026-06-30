"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";

/**
 * Registers our JavaScript/AJAX lead forms with CallRail's NATIVE form tracking
 * via CallTrk.captureForm() — so form submissions land in CallRail and can fire
 * a Message Flow / Automation Rule auto-text. No Zapier or third-party platform.
 *
 * Mark a form with id + data-cr-capture; this watcher attaches CallRail to it
 * once the CallRail script (swap.js) is loaded, and re-scans so forms that mount
 * later (e.g. a tool's result-step form) also get captured.
 */
export function CallRailFormCapture() {
  useEffect(() => {
    let stopped = false;
    const iv = setInterval(() => {
      if (stopped) return;
      const w = window as any;
      if (!w.CallTrk || typeof w.CallTrk.captureForm !== "function") return;
      document
        .querySelectorAll<HTMLFormElement>("form[data-cr-capture]")
        .forEach((f) => {
          if (!f.id || f.dataset.crDone || f.getAttribute("cr-attached") === "true") {
            return;
          }
          try {
            w.CallTrk.captureForm("#" + f.id);
            f.dataset.crDone = "1";
          } catch {
            /* ignore */
          }
        });
    }, 1000);
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, []);
  return null;
}
