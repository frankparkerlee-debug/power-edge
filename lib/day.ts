// Date helpers shared by server code and browser components.

/**
 * The calendar day a storm report happened on, in North Texas time.
 *
 * Report times arrive in UTC, and several screens took the date by slicing
 * the timestamp, so anything after 7pm Central (most hail here) was shown a
 * day late. The April 25 2026 storm hit Fort Worth that evening and read
 * "Apr 26" everywhere, which is the date a rep would hand a homeowner as the
 * date of loss.
 */
export function localDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  // en-CA formats as YYYY-MM-DD.
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/** A local YYYY-MM-DD plus or minus whole days (calendar math, no timezone). */
export function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T12:00:00Z`) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
