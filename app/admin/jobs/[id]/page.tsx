import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser, canSell } from "@/lib/auth";
import { getAppointment } from "@/lib/scheduling";
import { money, moneyShort, toNumber } from "@/lib/money";
import { JobActions, type Inspection } from "@/components/JobActions";
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
  inspection: "Inspection result",
  costs: "Revenue and costs entered",
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

  // The inspection this job is booked for, so the closer sees when and with
  // whom without leaving the record.
  const appt = job.appointment_id ? await getAppointment(job.appointment_id) : null;
  const inspection: Inspection = appt
    ? {
        when: new Date(String(appt.slot_start)).toLocaleString("en-US", {
          timeZone: "America/Chicago",
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        closer: (appt.closer as string | null) ?? null,
        status: String(appt.status || "booked"),
        note: (appt.notes as string | null) ?? null,
        setter: (appt.setter as string | null) ?? null,
      }
    : null;
  const sells = canSell(user.role);

  async function setStage(formData: FormData) {
    "use server";
    const next = String(formData.get("stage") || "");
    // Who is acting comes from the session, not the form, and only the office
    // may set a stage that should come from a real agreement.
    const me = await currentUser();
    if (!me) return;
    if (["agreement_sent", "signed"].includes(next) && me.role !== "admin") return;
    if (next) await updateJob(id, { stage: next as never }, me.name);
    revalidatePath(`/admin/jobs/${id}`);
  }

  async function addNote(formData: FormData) {
    "use server";
    const text = String(formData.get("note") || "").trim();
    // The author is whoever is signed in, not a hidden form field that anyone
    // could edit to put words in someone else's name on the record.
    const me = await currentUser();
    if (!me) return;
    if (text) {
      const { logEvent } = await import("@/lib/jobs");
      await logEvent(id, "note", text, me.name);
    }
    revalidatePath(`/admin/jobs/${id}`);
  }

  /*
   * Revenue and profit. The office enters what the roof finally brought in
   * and what it cost; the scoreboard reads them as revenue and profit per
   * roof. Closers see profit on roofs they closed; knockers never see it.
   */
  async function saveCosts(formData: FormData) {
    "use server";
    const me = await currentUser();
    if (!me || me.role !== "admin") return;
    const num = (k: string) => {
      const raw = String(formData.get(k) || "").replace(/[^0-9.]/g, "");
      if (!raw) return null;
      const v = Number(raw);
      return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
    };
    const patch = {
      final_value: num("final"),
      cost_materials: num("materials"),
      cost_labor: num("labor"),
      cost_other: num("other"),
      cost_commission: num("commission"),
    };
    const anyCost = [patch.cost_materials, patch.cost_labor, patch.cost_other, patch.cost_commission].some((v) => v != null);
    await updateJob(
      id,
      { ...patch, costs_entered_at: anyCost ? new Date().toISOString() : null, costs_by: anyCost ? me.name : null } as never,
      me.name,
    );
    const { logEvent } = await import("@/lib/jobs");
    const cost = (patch.cost_materials ?? 0) + (patch.cost_labor ?? 0) + (patch.cost_other ?? 0) + (patch.cost_commission ?? 0);
    await logEvent(
      id,
      "costs",
      [patch.final_value != null ? `Final ${moneyShort(patch.final_value)}` : null, anyCost ? `costs ${moneyShort(cost)}` : "costs cleared"]
        .filter(Boolean)
        .join(", "),
      me.name,
    );
    revalidatePath(`/admin/jobs/${id}`);
    revalidatePath("/admin/scoreboard");
  }

  const isAdmin = user.role === "admin";
  const seesJobProfit = isAdmin || (!!job.closer && job.closer === user.name && user.role !== "setter");
  const revenue = job.final_value ?? (job.contract_value ? toNumber(job.contract_value) : null);
  const costTotal =
    (job.cost_materials ?? 0) + (job.cost_labor ?? 0) + (job.cost_other ?? 0) + (job.cost_commission ?? 0);
  const profit = job.costs_entered_at && revenue != null ? revenue - costTotal : null;
  const sold = ["signed", "in_production", "complete"].includes(job.stage);

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
            {/*
              The agreement belongs to the closer, and it is the obvious next
              step once the roof has been inspected, so it leads then and steps
              back otherwise. "Book inspection" used to link to the public
              homeowner form; booking now lives below, prefilled from this job.
            */}
            {sells ? (
              <Link
                href={`/admin/contract?job=${job.id}`}
                className={`rounded-md px-4 py-2 text-sm font-bold ${
                  job.stage === "inspected"
                    ? "bg-[#0c7a40] text-white"
                    : "border border-gray-300 text-[#3b424e]"
                }`}
              >
                {job.stage === "inspected" ? "Price it and write the agreement" : "Write agreement"}
              </Link>
            ) : null}
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-3">
            {field("Type", job.job_type === "claim" ? "Insurance claim" : "Cash")}
            {/*
              Two people, shown separately. One "Rep" field meant whoever
              touched the job last owned it, so writing the agreement wiped
              the setter at the moment the job became worth money.
            */}
            {field("Set by", job.setter ?? job.rep)}
            {/* "Closed by" before anything was closed read as if the deal were done. */}
            {job.closer
              ? field(
                  ["signed", "in_production", "complete"].includes(job.stage) ? "Closed by" : "Closer",
                  job.closer,
                )
              : null}
            {field("Squares", job.squares)}
            {field("Carrier", job.carrier)}
            {field("Claim #", job.claim_number)}
            {field("Deductible", money(job.deductible))}
            {field("Contract value", money(job.contract_value))}
            {field("Phone", job.phone)}
            {field("Email", job.email)}
          </dl>
        </div>

        {sold && (isAdmin || seesJobProfit) ? (
          <section className="mt-4 rounded-lg border border-[#e3e6ea] bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#0b0e13]">Revenue and profit</h2>
              <p className="text-sm text-gray-600">
                {revenue != null ? (
                  <>
                    <strong className="text-[#0b0e13]">{moneyShort(revenue)}</strong> revenue
                    {job.final_value == null ? <span className="text-gray-400"> (contract value)</span> : null}
                  </>
                ) : (
                  "No price yet"
                )}
                {profit != null ? (
                  <>
                    {" · "}
                    <strong style={{ color: profit >= 0 ? "#0c7a40" : "#b42318" }}>{moneyShort(profit)}</strong> profit
                    {revenue ? <span className="text-gray-400"> ({Math.round((profit / revenue) * 100)}%)</span> : null}
                  </>
                ) : (
                  <span className="text-gray-400"> · costs not entered</span>
                )}
              </p>
            </div>
            {isAdmin ? (
              <form action={saveCosts} className="mt-4 grid gap-3 sm:grid-cols-5">
                {[
                  { name: "final", label: "Final amount", hint: "With supplements", v: job.final_value },
                  { name: "materials", label: "Materials", hint: "Shingles, underlayment", v: job.cost_materials },
                  { name: "labor", label: "Labor", hint: "Crew, tear-off", v: job.cost_labor },
                  { name: "other", label: "Other", hint: "Dumpster, permit", v: job.cost_other },
                  { name: "commission", label: "Commissions", hint: "Knocker and closer", v: job.cost_commission },
                ].map((f) => (
                  <label key={f.name} className="block">
                    <span className="block text-sm font-semibold text-[#3b424e]">{f.label}</span>
                    <span className="block text-xs text-gray-500">{f.hint}</span>
                    <span className="mt-1 flex items-center rounded-md border border-[#d7dbe0] px-2.5 focus-within:border-[#0c7a40]">
                      <span className="text-sm text-gray-400">$</span>
                      <input
                        name={f.name}
                        inputMode="decimal"
                        defaultValue={f.v ?? ""}
                        className="w-full bg-transparent px-1.5 py-2 text-[16px] tabular-nums outline-none sm:text-sm"
                      />
                    </span>
                  </label>
                ))}
                <div className="flex items-center gap-3 sm:col-span-5">
                  <button className="rounded-md bg-[#0b0e13] px-4 py-2.5 text-sm font-bold text-white">Save</button>
                  <span className="text-xs text-gray-500">
                    {job.costs_entered_at
                      ? `Entered by ${job.costs_by ?? "the office"}. The scoreboard uses these as this roof's actual profit.`
                      : "Until costs are entered, the scoreboard estimates this roof's profit from the company rates."}
                  </span>
                </div>
              </form>
            ) : null}
          </section>
        ) : null}

        <JobActions
          job={{
            id: job.id,
            stage: job.stage,
            address: job.address,
            owner_name: job.owner_name,
            phone: job.phone,
            email: job.email,
            squares: job.squares,
          }}
          inspection={inspection}
          canSell={sells}
        />

        {/* Stage is the one control that matters, so it gets its own row. */}
        <form action={setStage} className="mt-4 rounded-lg border border-[#e3e6ea] bg-white p-4">
          <input type="hidden" name="actor" value={user.name} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Move to
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {/*
              Agreement sent and Signed only come from a real agreement, so
              they are not offered as buttons except to the office, which may
              need to correct a record. A closer could otherwise tap Signed on
              a job with no contract behind it and the pipeline would count
              revenue that does not exist.
            */}
            {STAGES.filter(
              (s) =>
                s !== job.stage &&
                (user.role === "admin" || !["agreement_sent", "signed"].includes(s)),
            ).map((s) => (
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
                    {/* Costs are the office's and the closer's, not the knocker's. */}
                    {e.detail && (e.kind !== "costs" || seesJobProfit) ? (
                      <span className="font-normal text-gray-600"> · {e.detail}</span>
                    ) : null}
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
