import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { getJob, jobTimeline, updateJob, STAGES, STAGE_LABEL } from "@/lib/jobs";

/**
 * One job, end to end.
 *
 * The question this answers is the one that could not be answered before:
 * "what is happening at this house, who touched it, and what is next".
 */
export const metadata: Metadata = {
  title: "Job",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function when(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

const EVENT_LABEL: Record<string, string> = {
  created: "Job created",
  lead: "Came in from the website",
  stage: "Stage changed",
  knock: "Door knocked",
  call: "Called",
  note: "Note",
  appointment: "Inspection booked",
  agreement_sent: "Agreement sent",
  agreement_signed: "Agreement signed",
};

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { id } = await params;
  const { key } = await searchParams;
  const user = await currentUser(key);

  if (!user) {
    return (
      <div className="px-5 py-10">
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">Job</h1>
          <p className="mt-2 text-sm text-gray-600">
            <a href="/login" className="font-semibold text-[#0c7a40] underline">Sign in</a> to view.
          </p>
        </div>
      </div>
    );
  }

  const [job, timeline] = await Promise.all([getJob(id), jobTimeline(id)]);

  if (!job) {
    return (
      <div className="px-5 py-10">
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">Not found</h1>
          <p className="mt-2 text-sm text-gray-600">
            That job does not exist.{" "}
            <Link href="/admin/jobs" className="font-semibold text-[#0c7a40] underline">
              Back to jobs
            </Link>
          </p>
        </div>
      </div>
    );
  }

  async function setStage(formData: FormData) {
    "use server";
    const next = String(formData.get("stage") || "");
    const actor = String(formData.get("actor") || "");
    if (next) await updateJob(id, { stage: next as never }, actor);
    revalidatePath(`/admin/jobs/${id}`);
  }

  async function addNote(formData: FormData) {
    "use server";
    const text = String(formData.get("note") || "").trim();
    const actor = String(formData.get("actor") || "");
    if (text) {
      const { logEvent } = await import("@/lib/jobs");
      await logEvent(id, "note", text, actor);
    }
    revalidatePath(`/admin/jobs/${id}`);
  }

  const field = (label: string, value?: string | number | null) =>
    value ? (
      <div>
        <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</dt>
        <dd className="mt-0.5 text-sm font-semibold text-[#0b0e13]">{value}</dd>
      </div>
    ) : null;

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-[#e3e6ea] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-[#0b0e13]">
                {job.owner_name || "Unknown owner"}
              </h1>
              <p className="mt-0.5 text-gray-600">{job.address}</p>
            </div>
            <span className="rounded-full bg-[#0b0e13] px-3 py-1.5 text-xs font-bold text-white">
              {STAGE_LABEL[job.stage]}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {job.phone && (
              <a
                href={`tel:${job.phone}`}
                className="rounded-md border border-[#0c7a40] px-4 py-2 text-sm font-bold text-[#0c7a40]"
              >
                Call {job.phone}
              </a>
            )}
            <Link
              href={`/admin/contract?job=${job.id}`}
              className="rounded-md bg-[#0c7a40] px-4 py-2 text-sm font-bold text-white"
            >
              Write agreement
            </Link>
            <Link
              href="/schedule"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-bold text-[#3b424e]"
            >
              Book inspection
            </Link>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-3">
            {field("Type", job.job_type === "claim" ? "Insurance claim" : "Cash")}
            {field("Rep", job.rep)}
            {field("Squares", job.squares)}
            {field("Carrier", job.carrier)}
            {field("Claim #", job.claim_number)}
            {field("Deductible", job.deductible)}
            {field("Contract value", job.contract_value)}
            {field("Phone", job.phone)}
            {field("Email", job.email)}
          </dl>
        </div>

        {/* Stage is the one control that matters, so it gets its own row. */}
        <form action={setStage} className="mt-4 rounded-lg border border-[#e3e6ea] bg-white p-4">
          <input type="hidden" name="actor" value={user.name} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Move to
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {STAGES.filter((s) => s !== job.stage).map((s) => (
              <button
                key={s}
                name="stage"
                value={s}
                className="rounded-full border border-[#e3e6ea] px-3 py-1.5 text-xs font-bold text-[#3b424e] hover:border-[#0c7a40] hover:text-[#0c7a40]"
              >
                {STAGE_LABEL[s]}
              </button>
            ))}
            <button
              name="stage"
              value="lost"
              className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:border-red-400"
            >
              Lost
            </button>
          </div>
        </form>

        <form action={addNote} className="mt-4 flex gap-2">
          <input type="hidden" name="actor" value={user.name} />
          <input
            name="note"
            placeholder="Add a note…"
            className="flex-1 rounded-md border border-[#e3e6ea] bg-white px-4 py-2.5 text-sm"
          />
          <button className="rounded-md bg-[#0b0e13] px-4 py-2.5 text-sm font-bold text-white">
            Add
          </button>
        </form>

        <h2 className="mt-8 text-xs font-bold uppercase tracking-widest text-gray-500">
          History
        </h2>
        {timeline.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white p-5 text-center text-sm text-gray-500">
            Nothing recorded yet.
          </p>
        ) : (
          <ol className="mt-3 rounded-lg border border-[#e3e6ea] bg-white">
            {timeline.map((e) => (
              <li key={e.id} className="flex gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0c7a40]" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[#0b0e13]">
                    {EVENT_LABEL[e.kind] || e.kind}
                    {e.detail ? <span className="font-normal text-gray-600"> · {e.detail}</span> : null}
                  </div>
                  <div className="text-xs text-gray-500">
                    {when(e.created_at)}
                    {e.actor ? ` · ${e.actor}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
