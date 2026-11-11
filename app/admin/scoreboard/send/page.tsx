import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { lastWeekPeriod } from "@/lib/scoreboard";
import { buildScorecards } from "@/lib/scorecards";
import { sendScorecard } from "@/lib/emails";

/**
 * Weekly scorecards: preview, then send.
 *
 * Every rep gets their own week and their team's; admins get the company
 * report. Nothing goes out until an admin presses Send, and a week is never
 * sent to the same person twice (scorecard_sends).
 */
export const metadata: Metadata = { title: "Send scorecards", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function sentFor(periodStart: string) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/scorecard_sends?select=member_id,kind,sent_at,sent_by&period_start=eq.${periodStart}`,
    { headers: db(), cache: "no-store" },
  );
  return res.ok ? ((await res.json()) as Array<{ member_id: number; kind: string; sent_at: string; sent_by: string | null }>) : [];
}

async function sendAll() {
  "use server";
  const me = await currentUser();
  if (!me || me.role !== "admin") return;
  const key = process.env.RESEND_API_KEY;
  if (!key) redirect("/admin/scoreboard/send?error=Email+is+not+set+up");
  const period = lastWeekPeriod();
  const start = period.days[0];
  const [{ cards }, already] = await Promise.all([buildScorecards(period), sentFor(start)]);
  const done = new Set(already.map((s) => `${s.member_id}:${s.kind}`));
  let sent = 0;
  let failed = 0;
  for (const c of cards) {
    if (done.has(`${c.memberId}:${c.kind}`)) continue;
    const r = await sendScorecard(key as string, c.email, c.subject, c.html, c.kind === "company" ? "company-report" : "scorecard");
    if (!r.ok) {
      failed++;
      continue;
    }
    sent++;
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/scorecard_sends`, {
      method: "POST",
      headers: { ...db(), Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify({
        period_start: start,
        member_id: c.memberId,
        kind: c.kind,
        sent_by: me.name,
        provider_id: (r as { id?: string }).id ?? null,
      }),
    });
  }
  redirect(`/admin/scoreboard/send?sent=${sent}&failed=${failed}`);
}

export default async function SendScorecardsPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; sent?: string; failed?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user || user.role !== "admin") {
    return (
      <div className="px-5 py-10">
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">Scorecards</h1>
          <p className="mt-2 text-sm text-gray-600">Only an admin can send scorecards.</p>
        </div>
      </div>
    );
  }

  const period = lastWeekPeriod();
  const start = period.days[0];
  const [{ ok, cards }, already] = await Promise.all([buildScorecards(period), sentFor(start)]);
  const sentMap = new Map(already.map((s) => [`${s.member_id}:${s.kind}`, s] as const));
  const pending = cards.filter((c) => !sentMap.has(`${c.memberId}:${c.kind}`));
  const selected = cards.find((c) => String(c.memberId) === sp.preview) ?? cards[0];
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/scoreboard" className="text-sm font-semibold text-gray-500 hover:text-[#0b0e13]">
          Scoreboard
        </Link>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0b0e13]">
          Weekly scorecards <span className="text-gray-400">· {period.span}</span>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Each rep gets their own week and their team&apos;s; knockers never see profit or another team. Admins get the company
          report. Look through them, then send. Each person gets a week once.
        </p>

        {sp.sent ? (
          <p className="mt-4 rounded-md border border-[#0c7a40] bg-[#f0fbf4] p-3 text-sm font-semibold">
            Sent {sp.sent}.{Number(sp.failed) ? ` ${sp.failed} failed; they stay on the list to try again.` : ""}
          </p>
        ) : null}
        {sp.error ? <p className="mt-4 rounded-md border border-red-400 bg-red-50 p-3 text-sm font-semibold text-red-700">{sp.error}</p> : null}
        {!ok ? <p className="mt-4 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm">The numbers didn&apos;t load. Refresh in a minute.</p> : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div>
            <ul className="divide-y divide-[#eceef1] rounded-lg border border-[#e3e6ea] bg-white">
              {cards.map((c) => {
                const s = sentMap.get(`${c.memberId}:${c.kind}`);
                const on = selected && c.memberId === selected.memberId && c.kind === selected.kind;
                return (
                  <li key={`${c.memberId}:${c.kind}`}>
                    <Link
                      href={`/admin/scoreboard/send?preview=${c.memberId}`}
                      scroll={false}
                      className={`block px-4 py-3 ${on ? "bg-[#f3faf6]" : "hover:bg-[#f7f8f9]"}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-[#0b0e13]">{c.name}</span>
                        <span className="text-xs text-gray-500">
                          {c.kind === "company" ? "Company report" : c.team ?? "No team"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {s ? `Sent ${when(s.sent_at)}` : c.quiet ? "Not sent · quiet week" : "Not sent"}
                      </div>
                    </Link>
                  </li>
                );
              })}
              {cards.length === 0 ? <li className="px-4 py-6 text-sm text-gray-500">Nobody on the team with an email.</li> : null}
            </ul>
            <form action={sendAll} className="mt-4">
              <button
                disabled={pending.length === 0}
                className="w-full rounded-md bg-[#0c7a40] px-4 py-3 font-display font-bold text-white disabled:bg-gray-300"
              >
                {pending.length ? `Send ${pending.length} scorecard${pending.length === 1 ? "" : "s"}` : "All sent for this week"}
              </button>
              <p className="mt-2 text-xs text-gray-500">From hello@poweredgetx.com, replies to the team inbox.</p>
            </form>
          </div>

          <div>
            {selected ? (
              <>
                <div className="text-sm text-gray-600">
                  To <strong className="text-[#0b0e13]">{selected.email}</strong>
                  <br />
                  Subject: <strong className="text-[#0b0e13]">{selected.subject}</strong>
                </div>
                <iframe
                  title={`Scorecard for ${selected.name}`}
                  srcDoc={selected.html}
                  sandbox=""
                  className="mt-3 h-[60rem] w-full rounded-lg border border-[#e3e6ea] bg-white"
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
