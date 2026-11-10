import { listJobs, logEvent, updateJob } from "@/lib/jobs";

/**
 * Fresh hail near an existing job.
 *
 * This replaces the HubSpot version, which created HIGH-priority call tasks
 * against contacts when new hail landed near them. PowerEdge is running on
 * jobs now, so the same signal lands on the job timeline where the office and
 * the rep already look.
 *
 * Only jobs that are still open are worth flagging: a completed roof does not
 * need a call because it hailed again, but a homeowner who went quiet at
 * "contacted" very much does.
 */

const ALERT_RADIUS_MI = 12;
const MIN_HAIL_IN = 1;
const LOOKBACK_HOURS = 36;

function milesBetween(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function runStormJobAlerts(): Promise<{
  events: number;
  jobs: number;
  flagged: number;
  ok: boolean;
}> {
  const out = { events: 0, jobs: 0, flagged: 0, ok: true };
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ...out, ok: false };

  try {
    const since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();
    const res = await fetch(
      `${url}/rest/v1/storm_events?select=valid_at,magnitude,city,lat,lon&type=eq.hail&magnitude=gte.${MIN_HAIL_IN}&valid_at=gte.${since}&limit=300`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return { ...out, ok: false };
    const events = (await res.json()) as Array<{
      valid_at: string; magnitude: number; city: string; lat: number; lon: number;
    }>;
    out.events = events.length;
    if (events.length === 0) return out;

    const open = (await listJobs({ limit: 500 })).filter(
      (j) => j.lat != null && j.lon != null && !["complete", "lost"].includes(j.stage),
    );
    out.jobs = open.length;

    for (const job of open) {
      // Don't re-flag the same storm window every hour.
      const alerted = (job as unknown as { last_storm_alert_at?: string }).last_storm_alert_at;
      if (alerted && new Date(alerted).getTime() > Date.now() - LOOKBACK_HOURS * 3600 * 1000) {
        continue;
      }
      let worst: (typeof events)[number] | null = null;
      for (const e of events) {
        if (e.lat == null || e.lon == null) continue;
        const mi = milesBetween(job.lat as number, job.lon as number, e.lat, e.lon);
        if (mi <= ALERT_RADIUS_MI && (!worst || e.magnitude > worst.magnitude)) worst = e;
      }
      if (!worst) continue;

      await logEvent(
        job.id,
        "note",
        `Fresh hail nearby: ${worst.magnitude}" on ${new Date(worst.valid_at).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" })}${worst.city ? ` near ${worst.city}` : ""}. Worth a call.`,
        "Storm watch",
      );
      await updateJob(job.id, {
        last_storm_alert_at: new Date().toISOString(),
      } as never);
      out.flagged++;
    }
    return out;
  } catch {
    return { ...out, ok: false };
  }
}
