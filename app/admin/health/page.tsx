import type { Metadata } from "next";
import { recentEmailFailures } from "@/lib/sendMail";
import { listStormEvents } from "@/lib/storm";
import { listAppointments } from "@/lib/scheduling";
import { listLeads } from "@/lib/db";
import { site } from "@/lib/site";

/**
 * Operations health. NOT indexed. Gated by ?key=<ADMIN_TOKEN>.
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
  const adminToken = process.env.ADMIN_TOKEN;
  const authed = !!adminToken && key === adminToken;
  const wrap = "min-h-screen bg-white px-6 py-10 text-[#0b0e13]";

  if (!authed) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Health</h1>
          <p className="mt-2 text-sm text-gray-600">
            Add <code className="rounded bg-gray-100 px-1">?key=…</code> to view.
          </p>
        </div>
      </div>
    );
  }

  const [failures, events, appts, leads] = await Promise.all([
    recentEmailFailures(25),
    listStormEvents(30),
    listAppointments(200),
    listLeads(50),
  ]);

  const dayAgo = Date.now() - 86_400_000;
  const failuresToday = failures.filter(
    (f) => new Date(String(f.created_at)).getTime() > dayAgo,
  );

  // The storm feed runs hourly. created_at is when WE ingested, which is what
  // proves the cron is alive; valid_at only tells us when weather happened.
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
  // to site.email, but LEAD_TO_EMAIL silently overrides it, so changing
  // site.email alone may change nothing.
  const notifyTo = process.env.LEAD_TO_EMAIL || site.email;
  const overridden = !!process.env.LEAD_TO_EMAIL;

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
                overridden
                  ? "Set by LEAD_TO_EMAIL, which overrides site.email in the code."
                  : "From site.email. Set LEAD_TO_EMAIL in Render to send somewhere else."
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
              name="Storm feed"
              value={ingest.label}
              state={ingest.hours < 3 ? "ok" : ingest.hours < 24 ? "warn" : "bad"}
              note="Hourly cron. Over 3h means the job may be stalled."
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
