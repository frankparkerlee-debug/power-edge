import type { Metadata } from "next";
import { recentEmailFailures, recentSends } from "@/lib/sendMail";
import { deliveryStatuses, isBad } from "@/lib/deliveryStatus";
import { listStormEvents } from "@/lib/storm";
import { listAppointments } from "@/lib/scheduling";
import { listLeads, lastCronRun } from "@/lib/db";
import { site } from "@/lib/site";
import { currentUser } from "@/lib/auth";

/**
 * Operations health. NOT indexed. requires a signed-in team member.
 *
 * This page exists because of a specific failure: lead notification emails
 * stopped arriving for months and nothing anywhere said so. Resend returns an
 * HTTP error for a suppressed recipient rather than throwing, so every
 * fire-and-forget send reported success. Anything that can fail quietly and
 * cost a lead belongs on this page.
 */
export const metadata: Metadata = {
  title: "Health",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function ago(iso?: string | null) {
  if (!iso) return { label: "never", hours: Infinity };
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return { label: `${Math.round(h * 60)} min ago`, hours: h };
  if (h < 48) return { label: `${Math.round(h)} h ago`, hours: h };
  return { label: `${Math.round(h / 24)} days ago`, hours: h };
}

function Row({
  name,
  value,
  state,
  note,
}: {
  name: string;
  value: string;
  state: "ok" | "warn" | "bad";
  note?: string;
}) {
  const dot =
    state === "ok" ? "bg-emerald-500" : state === "warn" ? "bg-amber-500" : "bg-red-500";
  return (
    <tr className="border-b border-gray-100">
      <td className="py-3 pr-4">
        <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
        {name}
      </td>
      <td className="py-3 pr-4 font-semibold">{value}</td>
      <td className="py-3 text-gray-500">{note}</td>
    </tr>
  );
}

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const user = await currentUser(key);
  const authed = user?.role === "admin";
  const wrap = "min-h-screen bg-white px-6 py-10 text-[#0b0e13]";

  if (!authed) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Health</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to open this.
          </p>
        </div>
      </div>
    );
  }

  const [failures, events, appts, leads, lastCron] = await Promise.all([
    recentEmailFailures(25),
    listStormEvents(30),
    listAppointments(200),
    listLeads(50),
    lastCronRun(),
  ]);

  /*
   * What became of the last few emails, from the provider rather than from
   * our own record of having handed them over. email_log stores the HTTP
   * response to the send call, and a 200 there means accepted: a suppressed
   * address, a hard bounce a second later and a silent junking all look
   * identical at that moment. This page said "no failures in 24h" while an
   * agreement sat undelivered.
   */
  const sends = await recentSends(10);
  const deliveries = await deliveryStatuses(sends.map((x) => x.provider_id));
  const byId = new Map(deliveries.map((d) => [d.id, d]));
  const undelivered = deliveries.filter((d) => isBad(d.event));

  const dayAgo = Date.now() - 86_400_000;
  const failuresToday = failures.filter(
    (f) => new Date(String(f.created_at)).getTime() > dayAgo,
  );

  /*
   * Two different questions, which this page used to answer with one number.
   *
   * "Is the hourly job running" is answered by the job's own heartbeat. It was
   * previously inferred from the last storm row inserted, so a quiet week of
   * weather rendered the feed red and failing. A health page that cries wolf
   * over ordinary November gets ignored, and then it is worth nothing on the
   * day something really breaks.
   *
   * "Has it hailed lately" is the storm rows, which is information, not an
   * alarm. No hail is just no hail.
   */
  const cron = ago(lastCron);
  const lastIngest = events.length
    ? events
        .map((e) => (e as unknown as { created_at?: string }).created_at)
        .filter(Boolean)
        .sort()
        .reverse()[0]
    : null;
  const ingest = ago(lastIngest);

  const lastLead = leads.length ? leads[0].created_at : null;
  const lead = ago(lastLead);

  const upcoming = appts.filter(
    (a) => new Date(String(a.slot_start)).getTime() > Date.now(),
  );

  const mailState = failuresToday.length === 0 ? "ok" : "bad";

  // Where team notifications actually land. Worth showing: the code falls back
  // site.email is authoritative. If LEAD_TO_EMAIL is still set in Render
  // it is ignored, and the row below says so.
  const notifyTo = site.email;
  const stale = process.env.LEAD_TO_EMAIL;

  return (
    <div className={wrap}>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-extrabold">Operations health</h1>
        <p className="mt-1 text-sm text-gray-600">
          Everything here can fail quietly. That is why it is on a page.
        </p>

        <table className="mt-7 w-full border-collapse text-sm">
          <tbody>
            <Row
              name="Lead notifications go to"
              value={notifyTo}
              state={notifyTo.includes("@") ? "ok" : "bad"}
              note={
                stale
                  ? `LEAD_TO_EMAIL is still set to ${stale} in Render but is no longer used. Safe to delete it.`
                  : "From site.email, the only place this address lives."
              }
            />
            <Row
              name="Email delivery"
              value={
                failuresToday.length === 0
                  ? "No failures in 24h"
                  : `${failuresToday.length} failed in 24h`
              }
              state={mailState}
              note={
                failuresToday.length === 0
                  ? "A send that returns an HTTP error is recorded, not swallowed."
                  : "Leads may not be reaching the inbox. Check the table below."
              }
            />
            <Row
              name="Hourly job"
              value={cron.label}
              state={cron.hours < 3 ? "ok" : cron.hours < 24 ? "warn" : "bad"}
              note="Storm ingest, nurture mail, inspection reminders. Over 3h and it has stalled."
            />
            <Row
              name="Last hail ingested"
              value={ingest.label}
              state="ok"
              note="Weather, not a fault. Long gaps are normal outside storm season."
            />
            <Row
              name="Email actually delivered"
              value={
                deliveries.length === 0
                  ? "nothing to check"
                  : undelivered.length === 0
                    ? `last ${deliveries.length} delivered`
                    : `${undelivered.length} of ${deliveries.length} did not arrive`
              }
              state={undelivered.length === 0 ? "ok" : "bad"}
              note="Asked the provider, not our own send log. Accepted is not delivered."
            />
            <Row
              name="Last website lead"
              value={lead.label}
              state={lead.hours < 168 ? "ok" : "warn"}
              note="Quiet for over a week is worth a look at the forms."
            />
            <Row
              name="Upcoming inspections"
              value={String(upcoming.length)}
              state="ok"
              note="Booked through the site and not yet passed."
            />
          </tbody>
        </table>

        {/*
          What the provider says happened to each of the last few messages.
          "Accepted" and "arrived" are different facts and only one of them
          matters to the person waiting on an agreement.
        */}
        <h2 className="mt-10 text-xs font-bold uppercase tracking-widest text-gray-500">
          Last few emails, and whether they landed
        </h2>
        {sends.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            Nothing sent yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Kind</th>
                  <th className="py-2 pr-4">To</th>
                  <th className="py-2">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {sends.map((x) => {
                  const d = byId.get(x.provider_id);
                  const event = d?.event ?? "unknown";
                  const bad = isBad(event);
                  return (
                    <tr key={x.provider_id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 whitespace-nowrap text-gray-600">
                        {ago(x.created_at).label}
                      </td>
                      <td className="py-2 pr-4">{x.kind}</td>
                      <td className="py-2 pr-4 text-gray-600">{x.to_addr}</td>
                      <td
                        className={`py-2 font-semibold ${
                          bad
                            ? "text-red-600"
                            : event === "delivered"
                              ? "text-green-700"
                              : "text-gray-500"
                        }`}
                      >
                        {event === "delivered"
                          ? "Delivered"
                          : bad
                            ? `Did not arrive (${event})`
                            : event === "unknown"
                              ? "Provider did not say"
                              : event}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="mt-10 text-xs font-bold uppercase tracking-widest text-gray-500">
          Recent email failures
        </h2>
        {failures.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            Nothing recorded. Either every send succeeded, or nothing has been
            sent since this started being tracked.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Kind</th>
                  <th className="py-2 pr-4">To</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => (
                  <tr key={String(f.id)} className="border-b border-gray-100 align-top">
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {ago(String(f.created_at)).label}
                    </td>
                    <td className="py-2.5 pr-4">{String(f.kind)}</td>
                    <td className="py-2.5 pr-4">{String(f.to_addr ?? "")}</td>
                    <td className="py-2.5 pr-4 font-semibold text-red-600">
                      {String(f.status ?? "none")}
                    </td>
                    <td className="py-2.5 text-gray-600">
                      {String(f.error ?? "").slice(0, 160)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
