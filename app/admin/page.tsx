import type { Metadata } from "next";
import Link from "next/link";
import { currentUser, canSell } from "@/lib/auth";
import { listComeBacks } from "@/lib/knocks";
import { listJobs, pipelineOf, STAGE_LABEL } from "@/lib/jobs";
import { moneyShort } from "@/lib/money";
import { listAppointments, setsSince } from "@/lib/scheduling";
import { listLeads } from "@/lib/db";
import { recentEmailFailures } from "@/lib/sendMail";
import { listContracts } from "@/lib/contracts";
import { loadBoard, metricsFor, moneyOf, periodFor, rankBy, restrict, seesProfit, type Scope } from "@/lib/scoreboard";

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

/**
 * Today, in Chicago, as UTC instants.
 *
 * This used setHours(0,0,0,0) on the server's clock. Render runs in UTC, so
 * after 6pm Central "today" became tomorrow, and a closer checking their
 * evening would have seen tomorrow's inspections labelled as today's.
 */
function chicagoToday() {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const off =
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", timeZoneName: "shortOffset" })
      .formatToParts(new Date(`${ymd}T12:00:00Z`))
      .find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") ?? "-6";
  const h = Number(off) || -6;
  const z = `${h < 0 ? "-" : "+"}${String(Math.abs(h)).padStart(2, "0")}:00`;
  return {
    start: new Date(`${ymd}T00:00:00${z}`).getTime(),
    end: new Date(`${ymd}T23:59:59.999${z}`).getTime(),
  };
}

function greeting(name?: string) {
  const hr = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false })
      .format(new Date()),
  );
  const part = hr < 12 ? "Morning" : hr < 17 ? "Afternoon" : "Evening";
  return name ? `${part}, ${name.split(" ")[0]}.` : "Today";
}

function timeOnly(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
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
  const sells = canSell(user.role);
  // "rep" predates the split and does both halves.
  const sets = user.role === "setter" || user.role === "rep" || isAdmin;
  const me = user.name;

  const week = periodFor("week");
  const [allJobs, appts, leads, failures, contracts, comeBacks, board] = await Promise.all([
    listJobs({ limit: 500 }),
    listAppointments(200),
    isAdmin ? listLeads(50) : Promise.resolve([]),
    isAdmin ? recentEmailFailures(5) : Promise.resolve([]),
    listContracts(50),
    sets ? listComeBacks(isAdmin ? undefined : me) : Promise.resolve([]),
    loadBoard(week),
  ]);

  /*
   * One line from the scoreboard: where you stand this week, or for the
   * office, what the team has done. The board itself is a tap away.
   */
  let standing: { lead: string; rest: string } | null = null;
  if (board) {
    // The same cut as the scoreboard: your team, or the company for the office.
    const myTeam = board.reps.find((r) => r.who === me)?.team_id ?? null;
    const team = board.teams.find((x) => x.id === myTeam);
    const scope: Scope = isAdmin ? { kind: "company" } : team ? { kind: "team", id: team.id, name: team.name } : { kind: "self" };
    const b = restrict(board, scope, me, seesProfit(user.role));
    const setterRows = rankBy(b.reps, b.roofs, "setters", metricsFor("setters", false)[0]);
    const closerRows = rankBy(b.reps, b.roofs, "closers", metricsFor("closers", false)[0]);
    const asSetter = setterRows.find((r) => r.who === me && (user.role !== "closer" || r.knocks > 0));
    const asCloser = closerRows.find((r) => r.who === me && (user.role !== "setter" || r.ran > 0));
    const ord = (k: number) => `${k}${["th", "st", "nd", "rd"][((k % 100) - 20) % 10] || ["th", "st", "nd", "rd"][k % 100] || "th"}`;
    const where = team && !isAdmin ? ` on ${team.name}` : "";
    const m = moneyOf(b.roofs);
    if (asSetter?.rank && (asSetter.knocks > 0 || asSetter.sets > 0)) {
      standing = {
        lead: `You're ${ord(asSetter.rank)} of ${setterRows.length} knockers${where} this week.`,
        rest: `${asSetter.knocks.toLocaleString("en-US")} doors, ${asSetter.sets} set`,
      };
    } else if (asCloser?.rank && (asCloser.ran > 0 || asCloser.money.roofs > 0)) {
      standing = {
        lead: `You're ${ord(asCloser.rank)} of ${closerRows.length} closers${where} this week.`,
        rest: `${asCloser.money.roofs} roof${asCloser.money.roofs === 1 ? "" : "s"}, ${moneyShort(asCloser.money.revenue) || "$0"}`,
      };
    } else if (isAdmin) {
      standing = {
        lead: m.roofs ? `${moneyShort(m.perRoof)} revenue per roof this week${m.profitPerRoof != null ? `, ${moneyShort(m.profitPerRoof)} profit` : ""}.` : "No roofs signed this week yet.",
        rest: `${m.roofs} roof${m.roofs === 1 ? "" : "s"}, ${b.team.knocks.toLocaleString("en-US")} doors, ${b.team.sets} set`,
      };
    } else if (asSetter || asCloser) {
      standing = { lead: "Nothing on the board this week yet.", rest: "The first door counts" };
    }
  }

  /*
   * Whose work is whose. Jobs used to be filtered on rep, which moves to the
   * closer when an inspection is assigned, so a setter's jobs vanished from
   * their own page the moment they did their job. Setters see what they set,
   * closers what they close, the office everything.
   */
  const jobs = isAdmin
    ? allJobs
    : allJobs.filter((j) =>
        user.role === "setter"
          ? j.setter === me
          : j.closer === me || j.rep === me || j.setter === me,
      );

  const now = Date.now();
  const day = chicagoToday();
  const inDay = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= day.start && t <= day.end;
  };

  // A closer's own inspections, today and the next few days.
  const myInspections = appts.filter((a) => a.closer === me);
  const myToday = myInspections.filter((a) => inDay(String(a.slot_start)));
  const myNext = myInspections
    .filter((a) => new Date(String(a.slot_start)).getTime() > day.end)
    .slice(0, 5);
  // Bookings nobody is driving to. The office places these.
  const unassigned = appts.filter((a) => !a.closer);
  const todaysInspections = isAdmin ? appts.filter((a) => inDay(String(a.slot_start))) : myToday;

  // What the setter put on the calendar this week, including the ones that
  // have since been inspected. Counting only still-booked ones made a setter's
  // sets disappear the moment a closer did their part.
  const weekAgo = now - 7 * 86400000;
  const mySets = await setsSince(me, new Date(weekAgo).toISOString());
  const comeBacksDue = comeBacks.filter((c) => new Date(c.follow_up_at).getTime() <= day.end);

  const awaitingSignature = contracts.filter(
    (c) => String(c.status) === "sent" && (isAdmin || c.rep === me),
  );
  const toPrice = jobs.filter((j) => j.stage === "inspected");
  const newLeads = leads.filter((l) => hoursAgo(l.created_at) < 168);
  const openJobs = jobs.filter((j) => !["complete", "lost"].includes(j.stage));
  // The pipeline of what this person can see: their own, or everything for
  // the office. Setters do not price work, so they get counts, not dollars.
  const pipe = pipelineOf(jobs);
  const showMoney = sells;

  /** Each card is an action, not a statistic. */
  const actions = [
    {
      n: comeBacksDue.length,
      label: comeBacksDue.length === 1 ? "come-back due" : "come-backs due",
      href: "#come-backs",
      tone: comeBacksDue.some((c) => c.overdue) ? "warn" : comeBacksDue.length ? "live" : "quiet",
      hint: comeBacksDue.length
        ? "Doors you promised to go back to."
        : "Nothing owed today.",
      show: sets,
    },
    {
      n: todaysInspections.length,
      label: todaysInspections.length === 1 ? "inspection today" : "inspections today",
      href: "#inspections",
      tone: todaysInspections.length > 0 ? "live" : "quiet",
      hint: todaysInspections.length
        ? todaysInspections
            .map((a) => `${timeOnly(String(a.slot_start))} · ${String(a.name).split(" ")[0]}`)
            .slice(0, 3)
            .join("  ·  ")
        : "Nothing booked for today.",
      show: sells,
    },
    {
      n: toPrice.length,
      label: toPrice.length === 1 ? "inspected, not priced" : "inspected, not priced",
      href: "/admin/jobs?stage=inspected",
      tone: toPrice.length > 0 ? "warn" : "quiet",
      hint: toPrice.length ? "Damage found. Write the agreement while it's fresh." : "Nothing waiting on a price.",
      show: sells,
    },
    {
      n: awaitingSignature.length,
      label: "agreements awaiting signature",
      href: "/admin/jobs?stage=agreement_sent",
      tone: awaitingSignature.length > 0 ? "warn" : "quiet",
      hint: awaitingSignature.length
        ? "Sent but not signed. Every day cold costs you the deal."
        : "Nothing sitting unsigned.",
      show: sells,
    },
    {
      n: mySets.length,
      label: mySets.length === 1 ? "inspection set this week" : "inspections set this week",
      href: "/admin/appointments",
      tone: mySets.length > 0 ? "live" : "quiet",
      hint: mySets.length ? "On the calendar, with a closer." : "None yet this week.",
      show: user.role === "setter" || user.role === "rep",
    },
    {
      n: unassigned.length,
      label: unassigned.length === 1 ? "inspection with no closer" : "inspections with no closer",
      href: "/admin/appointments",
      tone: unassigned.length > 0 ? "warn" : "quiet",
      hint: unassigned.length ? "Booked, and nobody is driving to them." : "Every inspection has a closer.",
      show: isAdmin,
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
          {greeting(user.name)}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {isAdmin
            ? "What needs you, worst first."
            : user.role === "setter"
              ? "Your doors and your sets."
              : "Your inspections and your deals."}
        </p>

        {standing ? (
          <Link
            href="/admin/scoreboard"
            className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#e3e6ea] bg-white px-4 py-3 hover:border-[#0c7a40]"
          >
            <span className="text-sm">
              <span className="font-semibold text-[#0b0e13]">{standing.lead}</span>{" "}
              <span className="text-gray-500">{standing.rest}.</span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-[#0c7a40]">Scoreboard</span>
          </Link>
        ) : null}

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

        {/*
          The work itself, under the cards that point at it. A closer's own
          inspections with a way to get there; a setter's come-backs with a way
          to call ahead. The old list here was every inspection in the company,
          with no closer on it and nothing to tap.
        */}
        {sells && (myToday.length > 0 || myNext.length > 0 || (isAdmin && appts.length > 0)) && (
          <section id="inspections" className="mt-8 scroll-mt-20">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
              {isAdmin ? "Inspections" : "Your inspections"}
            </h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-[#e3e6ea] bg-white">
              {(isAdmin ? appts.slice(0, 8) : [...myToday, ...myNext]).map((a) => {
                const today = inDay(String(a.slot_start));
                const map = `https://maps.google.com/?q=${encodeURIComponent(String(a.address ?? ""))}`;
                return (
                  <div
                    key={String(a.id)}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[#0b0e13]">
                        <span className={today ? "text-[#0c7a40]" : "text-gray-500"}>
                          {today ? timeOnly(String(a.slot_start)) : dayLabel(String(a.slot_start))}
                        </span>
                        {" · "}
                        {String(a.name)}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {String(a.address ?? "")}
                        {isAdmin ? ` · ${a.closer ? String(a.closer) : "NO CLOSER"}` : ""}
                        {a.setter ? ` · set by ${String(a.setter)}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <a
                        href={map}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-[#d7dbe0] px-3 py-1.5 text-sm font-semibold text-[#3b424e]"
                      >
                        Directions
                      </a>
                      {a.job_id ? (
                        <Link
                          href={`/admin/jobs/${String(a.job_id)}`}
                          className="rounded-md bg-[#0c7a40] px-3 py-1.5 text-sm font-bold text-white"
                        >
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {sets && comeBacks.length > 0 && (
          <section id="come-backs" className="mt-8 scroll-mt-20">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Come-backs
            </h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-[#e3e6ea] bg-white">
              {comeBacks.slice(0, 12).map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#0b0e13]">
                      <span className={c.overdue ? "text-red-600" : "text-[#0c7a40]"}>
                        {c.overdue ? "Overdue" : dayLabel(c.follow_up_at)}
                      </span>
                      {" · "}
                      {c.address}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {c.note || "No note"}
                      {isAdmin && c.rep ? ` · ${c.rep}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {c.phone ? (
                      <a
                        href={`tel:${c.phone}`}
                        className="rounded-md border border-[#d7dbe0] px-3 py-1.5 text-sm font-semibold text-[#3b424e]"
                      >
                        Call
                      </a>
                    ) : null}
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-[#d7dbe0] px-3 py-1.5 text-sm font-semibold text-[#3b424e]"
                    >
                      Directions
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* The pipeline, which is the thing a CRM is actually for. */}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Pipeline
          </h2>
          <span className="ml-auto mr-4 text-sm text-gray-600">
            {showMoney ? (
              <>
                <strong className="text-[#0b0e13]">{moneyShort(pipe.openValue)}</strong> at stake
                {pipe.wonValue > 0 ? (
                  <>
                    {" · "}
                    <strong className="text-[#0c7a40]">{moneyShort(pipe.wonValue)}</strong> won
                  </>
                ) : null}
              </>
            ) : (
              <>
                <strong className="text-[#0b0e13]">{pipe.openCount}</strong> open
              </>
            )}
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
                  {showMoney ? (
                    <div className="mt-0.5 text-xs text-gray-600">
                      {sl.value > 0 ? (
                        <strong className="text-[#0b0e13]">{moneyShort(sl.value)}</strong>
                      ) : sl.count > 0 ? (
                        "no price yet"
                      ) : null}
                    </div>
                  ) : null}
                  {showMoney && sl.value > 0 && sl.unpriced > 0 ? (
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
          {sells && (
            <Link
              href="/admin/contract"
              className="rounded-lg border border-[#e3e6ea] bg-white p-4 hover:border-[#0c7a40]"
            >
              <div className="font-display font-bold text-[#0b0e13]">Write an agreement</div>
              <p className="mt-0.5 text-sm text-gray-600">
                Sign at the door, or send a link for them to sign later.
              </p>
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}
