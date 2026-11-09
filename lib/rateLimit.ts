/**
 * Rate limiting for public endpoints.
 *
 * Two layers, because they defend different things:
 *
 *  1. `burst()` is an in-process sliding window. It stops a single client
 *     hammering an endpoint. Render can run more than one instance, so this
 *     is per-instance and therefore a floor, not a guarantee. It is still the
 *     right first gate: it costs nothing and absorbs the common case.
 *
 *  2. For anything where an abusive write has lasting cost (a booked
 *     inspection window a real homeowner can no longer take), the caller adds
 *     a durable check against the database. See bookingsFromIpToday().
 */

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

// Keep the map from growing without bound on a long-lived instance.
const MAX_KEYS = 5000;
function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  if (buckets.size >= MAX_KEYS) buckets.clear();
}

/**
 * Returns null when the call is allowed, or the seconds to wait when it is not.
 */
export function burst(key: string, limit: number, windowMs: number): number | null {
  const now = Date.now();
  sweep(now);
  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (hit.count >= limit) return Math.max(1, Math.ceil((hit.resetAt - now) / 1000));
  hit.count++;
  return null;
}

/** Best-effort client address. Render sits behind a proxy, so trust x-forwarded-for's first hop. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function tooMany(seconds: number, message = "Too many requests. Try again shortly.") {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(seconds) },
  });
}
