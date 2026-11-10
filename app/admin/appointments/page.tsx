import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { listAppointments, inspectors } from "@/lib/scheduling";
import { currentUser, canSell } from "@/lib/auth";

/**
 * The inspection board.
 *
 * This page was admin only while "Inspections" sat in every setter's and
 * closer's navigation, so they tapped it and were told to sign in when they
 * already had. It also had no closer column, no setter, no link to the job,
 * and no way to move a booking, which meant the one person who could see the
 * calendar could not fix it.
 *
 * Now everyone sees the inspections that are theirs: a setter what they set, a
 * closer what they are driving to. The office sees all of them and can hand
 * one to a different closer, which is how a booking with nobody on it gets
 * covered.
 */
export const metadata: Metadata = {
  title: "Inspections",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function when(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; moved?: string; error?: string }>;
}) {
  const { key, moved, error } = await searchParams;
  const user = await currentUser(key);
  const wrap = "px-4 py-6 sm:px-6 sm:py-8 text-[#0b0e13]";

  if (!user) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Inspections</h1>
          <p className="mt-2 text-sm text-gray-600">
            <a href="/login" className="font-semibold text-[#0c7a40] underline">Sign in</a> to open
            this.
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const me = user.name;
  const [rows, people] = await Promise.all([
    listAppointments(200),
    isAdmin ? inspectors() : Promise.resolve([] as string[]),
  ]);
  const upcoming = rows.filter(
    (r) => new Date(r.slot_start).getTime() > Date.now() - 2 * 3600 * 1000,
  );
  const mine = isAdmin
    ? upcoming
    : upcoming.filter((r) =>
        user.role === "setter" ? r.setter === me : r.closer === me || r.setter === me,
      );
  const unassigned = mine.filter((r) => !r.closer);

  /** Hand a booking to a different closer. The office only. */
  async function reassign(formData: FormData) {
    "use server";
    const u = await currentUser();
    if (u?.role !== "admin") return;
    const id = String(formData.get("id") || "");
    const to = String(formData.get("closer") || "").trim();
    const jobId = String(formData.get("job_id") || "");
    if (!/^[0-9a-f-]{36}$/i.test(id) || !to || !process.env.SUPABASE_URL) return;

    // The (closer, slot_start) index refuses a closer who is already booked
    // in that window, which is the point: one person, one place at a time.
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...db(), Prefer: "return=minimal" },
      body: JSON.stringify({ closer: to }),
    });
    if (res.ok && /^[0-9a-f-]{36}$/i.test(jobId)) {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/jobs?id=eq.${jobId}`, {
        method: "PATCH",
        headers: { ...db(), Prefer: "return=minimal" },
        body: JSON.stringify({ closer: to, rep: to, updated_at: new Date().toISOString() }),
      });
      const { logEvent } = await import("@/lib/jobs");
      await logEvent(jobId, "note", `Inspection handed to ${to}`, u.name);
    }
    revalidatePath("/admin/appointments");
    const { redirect } = await import("next/navigation");
    redirect(
      res.ok
        ? `/admin/appointments?moved=${encodeURIComponent(to)}`
        : `/admin/appointments?error=${encodeURIComponent(`${to} is already booked in that window.`)}`,
    );
  }

  return (
    <div className={wrap}>
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold">
          {isAdmin ? "Inspections" : "Your inspections"}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {mine.length} upcoming · Dallas–Fort Worth time
          {isAdmin && unassigned.length > 0 ? (
            <strong className="text-red-600"> · {unassigned.length} with no closer</strong>
          ) : null}
        </p>

        {moved ? (
          <p className="mt-4 rounded-md border border-[#0c7a40] bg-[#f0fbf4] p-3 text-sm font-semibold">
            Handed to {moved}.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-red-400 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        {mine.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">
            {user.role === "setter" ? (
              <>
                Nothing set yet. Tap <strong>Appt set</strong> on a door on the{" "}
                <Link href="/admin/storms" className="font-semibold text-[#0c7a40] underline">
                  map
                </Link>{" "}
                to book one.
              </>
            ) : canSell(user.role) ? (
              "Nothing on your calendar yet. Inspections appear here as setters book them."
            ) : (
              "Nothing booked."
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {mine.map((r) => {
              const map = `https://maps.google.com/?q=${encodeURIComponent(r.address || "")}`;
              return (
                <div
                  key={r.id}
                  className={`rounded-lg border bg-white p-4 ${
                    !r.closer ? "border-red-300" : "border-[#e3e6ea]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display text-base font-bold">{when(r.slot_start)}</div>
                      <div className="mt-0.5 font-semibold">{r.name}</div>
                      {r.address ? (
                        <div className="text-sm text-gray-600">{r.address}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-gray-500">
                        {r.closer ? (
                          <>Closer: <strong className="text-[#0b0e13]">{r.closer}</strong></>
                        ) : (
                          <strong className="text-red-600">No closer assigned</strong>
                        )}
                        {" · "}
                        {r.setter ? `Set by ${r.setter}` : "Booked on the website"}
                      </div>
                      {r.notes ? (
                        <div className="mt-1 text-xs text-gray-600">Note: {r.notes}</div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {r.phone ? (
                        <a
                          href={`tel:${r.phone}`}
                          className="rounded-md border border-[#d7dbe0] px-3 py-1.5 text-sm font-semibold"
                        >
                          Call
                        </a>
                      ) : null}
                      {r.address ? (
                        <a
                          href={map}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-[#d7dbe0] px-3 py-1.5 text-sm font-semibold"
                        >
                          Directions
                        </a>
                      ) : null}
                      {r.job_id ? (
                        <Link
                          href={`/admin/jobs/${r.job_id}`}
                          className="rounded-md bg-[#0c7a40] px-3 py-1.5 text-sm font-bold text-white"
                        >
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  {isAdmin && people.length > 0 ? (
                    <form action={reassign} className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="job_id" value={r.job_id || ""} />
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor={`c-${r.id}`}>
                        {r.closer ? "Hand to" : "Assign"}
                      </label>
                      <select
                        id={`c-${r.id}`}
                        name="closer"
                        defaultValue={r.closer || ""}
                        className="rounded-md border border-[#d7dbe0] px-2 py-1.5 text-sm"
                      >
                        {!r.closer ? <option value="">Pick a closer</option> : null}
                        {people.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <button className="text-sm font-semibold text-[#0c7a40] underline">Save</button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
