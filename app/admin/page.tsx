import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listJobs, pipeline, STAGE_LABEL } from "@/lib/jobs";
import { moneyShort } from "@/lib/money";
import { listAppointments } from "@/lib/scheduling";
import { listLeads } from "@/lib/db";
import { recentEmailFailures } from "@/lib/sendMail";
import { listContracts } from "@/lib/contracts";

/**
 * Today.
 *
 * The portal had no home: signing in dropped you on a document list, and the
 * one dashboard led with "9 storm days / 15 hail reports" — numbers that are
 * easy to count and tell nobody what to do. This page is ordered by what costs
 * money to ignore, and every row is a link to the thing that fixes it.
 */
export const metadata: Metadata = {
  title: "Today",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function hoursAgo(iso?: string | null) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function dayLabel(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short", hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const user = await currentUser(key);

  if (!user) {
    return (
      <div className="px-5 py-10">
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">PowerEdge</h1>
          <p className="mt-2 text-sm text-gray-600">
            <a href="/login" className="font-semibold text-[#0c7a40] underline">Sign in</a>{" "}
            to open your tools.
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const mine = isAdmin ? undefined : user.name;

  const [jobs, appts, leads, failures, contracts] = await Promise.all([
    listJobs({ rep: mine, limit: 500 }),
    listAppointments(200),
    isAdmin ? listLeads(50) : Promise.resolve([]),
    isAdmin ? recentEmailFailures(5) : Promise.resolve([]),
    listContracts(50),
  ]);

  const now = Date.now();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

  const todaysInspections = appts.filter((a) => {
    const t = new Date(String(a.slot_start)).getTime();
    return t >= startOfDay.getTime() && t <= endOfDay.getTime();
  });
  const upcoming = appts.filter((a) => new Date(String(a.slot_start)).getTime() > now);

  const awaitingSignature = contracts.filter((c) => String(c.status) === "sent");
  const needsFollowUp = jobs.filter((j) => j.stage === "inspected" || j.stage === "contacted");
  const newLeads = leads.filter((l) => hoursAgo(l.created_at) < 168);
  const openJobs = jobs.filter((j) => !["complete", "lost"].includes(j.stage));
  const pipe = await pipeline();

  /** Each card is an action, not a statistic. */
  const actions = [
    {
      n: todaysInspections.length,
      label: todaysInspections.length === 1 ? "inspection today" : "inspections today",
      href: "/admin/appointments",
      tone: todaysInspections.length > 0 ? "live" : "quiet",
      hint: todaysInspections.length
        ? todaysInspections.map((a) => `${dayLabel(String(a.slot_start))} · ${a.name}`).slice(0, 3).join("  ·  ")
        : "Nothing booked for today.",
      show: true,
    },
    {
      n: awaitingSignature.length,
      label: "agreements awaiting signature",
      href: "/admin/jobs?stage=agreement_sent",
      tone: awaitingSignature.length > 0 ? "warn" : "quiet",
      hint: awaitingSignature.length
        ? "Sent but not signed. Every day cold costs you the deal."
        : "Nothing sitting unsigned.",
      show: true,
    },
    {
      n: needsFollowUp.length,
      label: "jobs waiting on you",
      href: "/admin/jobs",
      tone: needsFollowUp.length > 0 ? "warn" : "quiet",
      hint: "Inspected or contacted, no next step booked.",
      show: true,
    },
    {
      n: newLeads.length,
      label: "new leads this week",
      href: "/admin/leads",
      tone: newLeads.length > 0 ? "live" : "quiet",
      hint: newLeads.length ? "From the website." : "Quiet week on the site.",
      show: isAdmin,
    },
  ].filter((a) => a.show);

  const tone: Record<string, string> = {
    live: "border-[#0c7a40] bg-[#f0fbf4]",
    warn: "border-amber-400 bg-amber-50",
    quiet: "border-[#e3e6ea] bg-white",
  };

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-extrabold text-[#0b0e13]">
          {user.name ? `Morning, ${user.name.split(" ")[0]}.` : "Today"}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {isAdmin ? "What needs you, worst first." : "Your day."}
        </p>

        {failures.length > 0 && (
          <Link
            href="/admin/health"
            className="mt-5 block rounded-lg border-2 border-red-400 bg-red-50 p-4"
          >
            <div className="font-display font-bold text-red-700">
              {failures.length} email{failures.length === 1 ? "" : "s"} failed to send
            </div>
            <div className="mt-0.5 text-sm text-red-700/80">
              Leads may not be reaching the inbox. Open Health.
            </div>
          </Link>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {actions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className={`rounded-lg border-2 p-4 transition-shadow hover:shadow-md ${tone[a.tone]}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-extrabold text-[#0b0e13]">{a.n}</span>
                <span className="font-semibold text-[#3b424e]">{a.label}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{a.hint}</p>
            </Link>
          ))}
        </div>

        {/* The pipeline, which is the thing a CRM is actually for. */}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Pipeline
          </h2>
          <span className="ml-auto mr-4 text-sm text-gray-600">
            <strong className="text-[#0b0e13]">{moneyShort(pipe.openValue)}</strong> at stake
            {pipe.wonValue > 0 ? (
              <>
                {" · "}
                <strong className="text-[#0c7a40]">{moneyShort(pipe.wonValue)}</strong> won
              </>
            ) : null}
          </span>
          <Link href="/admin/jobs" className="text-sm font-semibold text-[#0c7a40] hover:underline">
            All jobs →
          </Link>
        </div>

        {/*
          Stages, with the money sitting at each.
          Counts on their own do not say whether a week went well: four jobs
          at "agreement sent" is a different business at $24k than at $140k,
          and the stage worth attention is usually the one with the most money
          standing still, not the most rows.
        */}
        <div className="mt-3 overflow-x-auto">
          <div className="flex min-w-max gap-2">
            {pipe.slices.map((sl) => {
              const live = sl.count > 0;
              return (
                <Link
                  key={sl.stage}
                  href={`/admin/jobs?stage=${sl.stage}`}
                  className={`min-w-[7.5rem] flex-1 rounded-lg border p-3 ${
                    live
                      ? "border-[#d7dbe0] bg-white"
                      : "border-dashed border-gray-200 bg-transparent"
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    {sl.label}
                  </div>
                  <div
                    className={`mt-1 font-display text-xl font-extrabold ${
                      live ? "text-[#0b0e13]" : "text-gray-300"
                    }`}
                  >
                    {sl.count}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-600">
                    {sl.value > 0 ? (
                      <strong className="text-[#0b0e13]">{moneyShort(sl.value)}</strong>
                    ) : sl.count > 0 ? (
                      "no price yet"
                    ) : (
                      "\u2014"
                    )}
                  </div>
                  {sl.value > 0 && sl.unpriced > 0 ? (
                    <div className="mt-0.5 text-[11px] text-[#b54708]">
                      +{sl.unpriced} unpriced
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        {openJobs.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
            <p className="text-sm text-gray-600">
              No open jobs yet. Jobs appear when you convert a door on the{" "}
              <Link href="/admin/storms" className="font-semibold text-[#0c7a40] underline">
                knock map
              </Link>{" "}
              or a homeowner books an inspection.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#e3e6ea] bg-white">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {openJobs.slice(0, 8).map((j) => (
                  <tr key={j.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 pl-4 pr-3">
                      <Link href={`/admin/jobs/${j.id}`} className="font-semibold text-[#0b0e13] hover:underline">
                        {j.owner_name || "Unknown owner"}
                      </Link>
                      <div className="text-xs text-gray-500">{j.address}</div>
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <span className="rounded-full bg-[#0b0e13] px-2.5 py-1 text-xs font-bold text-white">
                        {STAGE_LABEL[j.stage]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-xs text-gray-500 whitespace-nowrap">
                      {j.job_type === "claim" ? "Claim" : "Cash"}
                      {j.contract_value ? ` · ${j.contract_value}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/admin/storms"
            className="rounded-lg border border-[#e3e6ea] bg-white p-4 hover:border-[#0c7a40]"
          >
            <div className="font-display font-bold text-[#0b0e13]">Knock map</div>
            <p className="mt-0.5 text-sm text-gray-600">
              Storm-hit doors near you, with owner names and hail size.
            </p>
          </Link>
          <Link
            href="/admin/contract"
            className="rounded-lg border border-[#e3e6ea] bg-white p-4 hover:border-[#0c7a40]"
          >
            <div className="font-display font-bold text-[#0b0e13]">Write an agreement</div>
            <p className="mt-0.5 text-sm text-gray-600">
              Sign at the door, or send a link for them to sign later.
            </p>
          </Link>
        </div>

        {upcoming.length > 0 && (
          <>
            <h2 className="mt-8 text-xs font-bold uppercase tracking-widest text-gray-500">
              Next inspections
            </h2>
            <div className="mt-3 rounded-lg border border-[#e3e6ea] bg-white">
              {upcoming.slice(0, 5).map((a) => (
                <div
                  key={String(a.id)}
                  className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-0"
                >
                  <div>
                    <div className="font-semibold text-[#0b0e13]">{String(a.name)}</div>
                    <div className="text-xs text-gray-500">{String(a.address ?? "")}</div>
                  </div>
                  <div className="text-right text-sm font-semibold whitespace-nowrap text-[#0c7a40]">
                    {dayLabel(String(a.slot_start))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
