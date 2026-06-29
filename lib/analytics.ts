// Thin GA4 event wrapper. No-ops safely if analytics isn't loaded (e.g. before
// NEXT_PUBLIC_GA_ID is set), so calls are always safe.
export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag === "function") {
    w.gtag("event", event, params);
  }
}
