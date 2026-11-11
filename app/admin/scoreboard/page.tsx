import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import {
  loadScoreboard,
  metricsFor,
  periodFor,
  PERIODS,
  restrict,
  seesProfit,
  type MetricKey,
  type PeriodKey,
  type Scope,
} from "@/lib/scoreboard";
import { Scoreboard } from "@/components/Scoreboard";

/**
 * The scoreboard.
 *
 * Revenue and profit per roof lead for everyone. Admins see the company,
 * every team and every person, and push them out (meeting view, weekly
 * scorecards). Everyone else sees their own numbers and their team, ranked.
 * Closers see profit; knockers see revenue. All of that is cut on the server
 * (restrict) before anything renders.
 */
export const metadata: Metadata = {
  title: "Scoreboard",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

async function saveEstimates(formData: FormData) {
  "use server";
  const me = await currentUser();
  if (!me || me.role !== "admin") return;
  const num = (k: string) => {
    const raw = String(formData.get(k) || "").replace(/[^0-9.]/g, "");
    const v = raw ? Number(raw) : null;
    return v != null && Number.isFinite(v) && v >= 0 ? v : null;
  };
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/scoreboard_settings?id=eq.1`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      est_cost_per_square: num("cps"),
      est_other_per_job: num("other"),
      est_commission_pct: num("commission"),
      updated_at: new Date().toISOString(),
      updated_by: me.name,
    }),
  });
  revalidatePath("/admin/scoreboard");
}

export default async function ScoreboardPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; p?: string; board?: string; who?: string; team?: string; rank?: string; present?: string }>;
}) {
  const sp = await searchParams;
  const user = await currentUser(sp.key);

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

  const isAdmin = user.role === "admin";
  const periodKey: PeriodKey = PERIODS.some((x) => x.key === sp.p) ? (sp.p as PeriodKey) : "week";
  const period = periodFor(periodKey);
  const data = await loadScoreboard(period);

  /*
   * Whose numbers this page may show. An admin picks; everyone else gets
   * their team, or only themselves until the office puts them on one.
   */
  const teams = data.now.teams;
  let scope: Scope;
  if (isAdmin) {
    const t = teams.find((x) => String(x.id) === sp.team);
    scope = t ? { kind: "team", id: t.id, name: t.name } : { kind: "company" };
  } else {
    const myTeam = data.now.reps.find((r) => r.who === user.name)?.team_id ?? null;
    const t = teams.find((x) => x.id === myTeam);
    scope = t ? { kind: "team", id: t.id, name: t.name } : { kind: "self" };
  }
  const showProfit = seesProfit(user.role);
  const now = restrict(data.now, scope, user.name, showProfit);
  const before = restrict(data.before, scope, user.name, showProfit);
  const inScope = new Set(now.reps.map((r) => r.who));
  const days = data.days.filter((d) => inScope.has(d.who));

  const boardKey = sp.board === "closers" || sp.board === "setters" ? sp.board : user.role === "closer" ? "closers" : "setters";
  const rank = metricsFor(boardKey, showProfit).some((m) => m.key === sp.rank) ? (sp.rank as MetricKey) : null;
  // Coaching is about doors, so it opens on yours if you knock, else on the team.
  const mineActive = now.reps.some((r) => r.who === user.name && r.knocks > 0);
  const focus = sp.who && inScope.has(sp.who) ? sp.who : sp.who === "team" ? "team" : mineActive ? user.name : "team";
  const s = data.now.settings;

  const footer = isAdmin ? (
    <section id="estimates" className="mt-12 scroll-mt-20 border-t border-[#e3e6ea] pt-6">
      <h2 className="font-display text-lg font-bold text-[#0b0e13]">How profit is estimated</h2>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">
        A roof shows its actual profit once its costs are entered on the job. Until then, if the job has squares, profit is
        estimated from these rates and marked estimated. Leave the first box blank to show only actual profit. Admins only.
      </p>
      <form action={saveEstimates} className="mt-4 flex flex-wrap items-end gap-4">
        {[
          { name: "cps", label: "Cost per square", hint: "Materials, labor, tear-off", v: s.est_cost_per_square, prefix: "$" },
          { name: "other", label: "Other cost per job", hint: "Dumpster, permit, delivery", v: s.est_other_per_job, prefix: "$" },
          { name: "commission", label: "Commissions", hint: "Percent of revenue", v: s.est_commission_pct, prefix: "%" },
        ].map((f) => (
          <label key={f.name} className="block">
            <span className="block text-sm font-semibold text-[#3b424e]">{f.label}</span>
            <span className="block text-xs text-gray-500">{f.hint}</span>
            <span className="mt-1 flex items-center rounded-md border border-[#d7dbe0] bg-white px-2.5 focus-within:border-[#0c7a40]">
              <span className="text-sm text-gray-400">{f.prefix}</span>
              <input
                name={f.name}
                inputMode="decimal"
                defaultValue={f.v ?? ""}
                className="w-28 bg-transparent px-1.5 py-2 text-[16px] tabular-nums outline-none sm:text-sm"
              />
            </span>
          </label>
        ))}
        <button className="rounded-md bg-[#0b0e13] px-4 py-2.5 text-sm font-bold text-white">Save rates</button>
      </form>
    </section>
  ) : null;

  return (
    <Scoreboard
      period={period}
      now={now}
      before={before}
      days={days}
      me={{ name: user.name, role: user.role }}
      scope={scope}
      allTeams={isAdmin ? teams : []}
      board={boardKey}
      rank={rank}
      focus={focus}
      showProfit={showProfit}
      isAdmin={isAdmin}
      basePath="/admin/scoreboard"
      // eslint-disable-next-line react-hooks/purity -- a server page rendered once per request
      nowMs={Date.now()}
      loadFailed={!data.ok}
      present={isAdmin && sp.present === "1"}
      footer={footer}
    />
  );
}
