import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listJobs, STAGES, STAGE_LABEL, type Job } from "@/lib/jobs";

/** The job list, grouped by stage. This is the CRM view that did not exist. */
export const metadata: Metadata = {
  title: "Jobs",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function ago(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mo`;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; stage?: string; mine?: string }>;
}) {
  const { key, stage, mine } = await searchParams;
  const user = await currentUser(key);

  if (!user) {
    return (
      <div className="px-5 py-10">
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">Jobs</h1>
          <p className="mt-2 text-sm text-gray-600">
            <a href="/login" className="font-semibold text-[#0c7a40] underline">Sign in</a> to view.
          </p>
        </div>
      </div>
    );
  }

  const onlyMine = mine === "1" || user.role !== "admin";
  const all = await listJobs({
    stage: stage && STAGES.includes(stage as never) ? stage : undefined,
    limit: 400,
  });
  /*
   * "Mine" filtered on rep, and rep moves to the closer when an inspection is
   * assigned, so a setter's jobs disappeared from their own list the moment
   * they booked them. A job is yours if you set it, are closing it, or own it.
   */
  const me = user.name;
  const jobs = onlyMine
    ? all.filter((j) =>
        user.role === "setter" ? j.setter === me : j.setter === me || j.closer === me || j.rep === me,
      )
    : all;

  const byStage = new Map<string, Job[]>();
  for (const j of jobs) {
    const list = byStage.get(j.stage) ?? [];
    list.push(j);
    byStage.set(j.stage, list);
  }

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-bold ${
      on ? "bg-[#0b0e13] text-white" : "bg-white text-[#3b424e] border border-[#e3e6ea]"
    }`;

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/jobs" className={chip(!stage)}>All</Link>
          {STAGES.map((s) => (
            <Link key={s} href={`/admin/jobs?stage=${s}`} className={chip(stage === s)}>
              {STAGE_LABEL[s]}
              {byStage.get(s)?.length ? ` ${byStage.get(s)!.length}` : ""}
            </Link>
          ))}
          {user.role === "admin" && (
            <Link href={`/admin/jobs${onlyMine ? "" : "?mine=1"}`} className={chip(onlyMine)}>
              Mine
            </Link>
          )}
        </div>

        {jobs.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="font-display text-lg font-bold text-[#0b0e13]">No jobs here yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-600">
              A job is created when you convert a door on the knock map, when a homeowner books
              an inspection, or when you write an agreement. It carries the property, the owner,
              the stage and the whole history in one place.
            </p>
            <Link
              href="/admin/storms"
              className="mt-4 inline-block rounded-md bg-[#0c7a40] px-5 py-2.5 font-bold text-white"
            >
              Open the knock map
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {jobs.map((j) => (
              <Link
                key={j.id}
                href={`/admin/jobs/${j.id}`}
                className="block rounded-lg border border-[#e3e6ea] bg-white p-4 transition-colors hover:border-[#0c7a40]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-bold text-[#0b0e13]">
                      {j.owner_name || "Unknown owner"}
                    </div>
                    <div className="truncate text-sm text-gray-600">{j.address}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#0b0e13] px-2.5 py-1 text-xs font-bold text-white">
                    {STAGE_LABEL[j.stage]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>{j.job_type === "claim" ? "Insurance claim" : "Cash"}</span>
                  {j.contract_value && <span>· {j.contract_value}</span>}
                  {j.squares && <span>· {j.squares} sq</span>}
                  {j.rep && <span>· {j.rep}</span>}
                  <span className="ml-auto">{ago(j.updated_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
