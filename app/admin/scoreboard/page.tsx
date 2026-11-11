import type { Metadata } from "next";
import Link from "next/link";
import { currentUser, canSell } from "@/lib/auth";
import { loadScoreboard, periodFor, PERIODS, type PeriodKey } from "@/lib/scoreboard";
import { Scoreboard } from "@/components/Scoreboard";

/**
 * The scoreboard: every rep's numbers, open to everyone on the team.
 *
 * Transparency is the point. A setter sees where they rank, what the person
 * above them does differently, and the one step where they lose the most
 * doors. The office sees the funnel, the board and the coaching for anyone.
 */
export const metadata: Metadata = {
  title: "Scoreboard",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ScoreboardPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; p?: string; board?: string; who?: string }>;
}) {
  const { key, p, board, who } = await searchParams;
  const user = await currentUser(key);

  if (!user) {
    return (
      <div className="px-5 py-10">
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">Scoreboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            <Link href="/login" className="font-semibold text-[#0c7a40] underline">
              Sign in
            </Link>{" "}
            to see the board.
          </p>
        </div>
      </div>
    );
  }

  const periodKey: PeriodKey = PERIODS.some((x) => x.key === p) ? (p as PeriodKey) : "week";
  const period = periodFor(periodKey);
  const data = await loadScoreboard(period);

  const boardKey = board === "closers" || board === "setters" ? board : user.role === "closer" ? "closers" : "setters";
  const names = new Set(data.now.reps.map((r) => r.who));
  const mineActive = data.now.reps.some(
    (r) => r.who === user.name && (r.knocks > 0 || r.sets > 0 || r.ran > 0 || r.signed > 0),
  );
  const focus = who && names.has(who) ? who : who === "team" ? "team" : mineActive ? user.name : "team";

  return (
    <Scoreboard
      period={period}
      now={data.now}
      before={data.before}
      days={data.days}
      me={{ name: user.name, role: user.role }}
      board={boardKey}
      focus={focus}
      money={canSell(user.role)}
      isAdmin={user.role === "admin"}
      basePath="/admin/scoreboard"
      nowMs={Date.now()}
      loadFailed={!data.ok}
    />
  );
}
