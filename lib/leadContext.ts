// Client-side attribution attached to every lead submission, so each lead
// arrives tagged with the page and campaign that produced it.
export function leadContext(
  extra: Record<string, string> = {},
): Record<string, string> {
  if (typeof window === "undefined") return { ...extra };
  const q = new URLSearchParams(window.location.search);
  const get = (k: string) => q.get(k) || "";
  return {
    page_path: window.location.pathname,
    referrer: document.referrer || "",
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    gclid: get("gclid"),
    ...extra,
  };
}
