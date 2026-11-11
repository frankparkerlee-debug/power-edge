import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { startOnboarding } from "@/lib/onboardingSequence";
import { DEFAULT_GOALS } from "@/lib/scoreboard";
import {
  currentUser,
  listMembers,
  addMember,
  setMemberActive,
  setMemberRole,
  setMemberGoals,
  listTeams,
  createTeam,
  updateTeam,
  setMemberTeam,
  setMemberInspections,
  ASSIGNABLE_ROLES,
  type Role,
} from "@/lib/auth";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

function when(iso?: string | null) {
  if (!iso) return "never";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "never";
  }
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; added?: string; sent?: string; error?: string }>;
}) {
  const { key, added, sent, error } = await searchParams;
  const user = await currentUser(key);
  const wrap = "min-h-screen bg-white px-5 py-8 text-[#0b0e13] sm:px-6";

  if (!user) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Team</h1>
          <p className="mt-2 text-sm text-gray-600">Sign in to open this.</p>
        </div>
      </div>
    );
  }

  // Who can sign in is an admin decision. A closer adding themselves an admin
  // account would make the setter/closer split decorative.
  if (user.role !== "admin") {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Team</h1>
          <p className="mt-2 text-sm text-gray-600">
            Only an admin can add or change who signs in. Ask the office.
          </p>
        </div>
      </div>
    );
  }

  const [members, teams] = await Promise.all([listMembers(), listTeams()]);
  const liveTeams = teams.filter((t) => t.active);

  // Add someone and, unless the box is unticked, start their onboarding:
  // the welcome goes now and the reminders run on their own from there.
  async function add(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim();
    const role = String(formData.get("role") || "setter") as Role;
    const r = await addMember({ email: String(formData.get("email") || ""), name, role });
    if (!r.ok) redirect(`/admin/team?error=${encodeURIComponent(r.error)}`);
    const teamId = Number(formData.get("team") || 0);
    if (r.id && teamId) await setMemberTeam(r.id, teamId);
    let sentFlag = "";
    if (r.id && role !== "admin" && formData.get("welcome") === "on") {
      sentFlag = (await startOnboarding(r.id)).ok ? "1" : "0";
    }
    revalidatePath("/admin/team");
    revalidatePath("/admin/onboarding");
    redirect(`/admin/team?added=${encodeURIComponent(name)}${sentFlag ? `&sent=${sentFlag}` : ""}`);
  }

  async function toggle(formData: FormData) {
    "use server";
    await setMemberActive(
      Number(formData.get("id")),
      String(formData.get("to")) === "on",
    );
    revalidatePath("/admin/team");
  }

  async function addTeam(formData: FormData) {
    "use server";
    const me = await currentUser();
    if (me?.role !== "admin") return;
    await createTeam(String(formData.get("name") || ""));
    revalidatePath("/admin/team");
  }

  async function editTeam(formData: FormData) {
    "use server";
    const me = await currentUser();
    if (me?.role !== "admin") return;
    const id = Number(formData.get("id"));
    const retire = String(formData.get("retire") || "") === "1";
    await updateTeam(id, retire ? { active: false } : { name: String(formData.get("name") || "") });
    revalidatePath("/admin/team");
    revalidatePath("/admin/scoreboard");
  }

  async function toggleInspections(formData: FormData) {
    "use server";
    const me = await currentUser();
    if (me?.role !== "admin") return;
    await setMemberInspections(Number(formData.get("id")), String(formData.get("to")) === "on");
    revalidatePath("/admin/team");
  }

  async function moveToTeam(formData: FormData) {
    "use server";
    const me = await currentUser();
    if (me?.role !== "admin") return;
    const raw = String(formData.get("team") || "");
    await setMemberTeam(Number(formData.get("id")), raw ? Number(raw) : null);
    revalidatePath("/admin/team");
    revalidatePath("/admin/scoreboard");
  }

  async function saveGoals(formData: FormData) {
    "use server";
    const num = (k: string) => {
      const raw = String(formData.get(k) || "").replace(/[^0-9.]/g, "");
      return raw ? Number(raw) : null;
    };
    await setMemberGoals(Number(formData.get("id")), {
      knocksWeek: num("knocks"),
      setsWeek: num("sets"),
      signedMonth: num("signed"),
    });
    revalidatePath("/admin/team");
    revalidatePath("/admin/scoreboard");
  }

  async function changeRole(formData: FormData) {
    "use server";
    await setMemberRole(Number(formData.get("id")), String(formData.get("role")) as Role);
    revalidatePath("/admin/team");
  }

  const input =
    "w-full rounded-md border border-[#d7dbe0] px-3 py-2.5 text-[16px] focus:border-[#0c7a40] focus:outline-none";
  const label = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1";

  return (
    <div className={wrap}>
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold">Team</h1>
        <p className="mt-1 text-sm text-gray-600">
          Who can sign in, and what they can do. Nobody can reach the tools
          without being on this list.
        </p>

        {added ? (
          sent === "1" ? (
            <p className="mt-4 rounded-md border border-[#0c7a40] bg-[#f0fbf4] p-3 text-sm">
              <strong>Added {added}. Their welcome email is on its way.</strong> Reminders run on their own until they finish, and
              you&apos;ll get an email when the ride-along and gear are yours. Follow along on{" "}
              <Link href="/admin/onboarding" className="font-semibold text-[#0c7a40] underline">Onboarding</Link>.
            </p>
          ) : sent === "0" ? (
            <p className="mt-4 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Added {added}, but the welcome email didn&apos;t send.</strong> Open them on{" "}
              <Link href="/admin/onboarding" className="font-semibold underline">Onboarding</Link> to send it again.
            </p>
          ) : (
            <p className="mt-4 rounded-md border border-[#0c7a40] bg-[#f0fbf4] p-3 text-sm font-semibold">
              Added {added}. They sign in at /login with their work email, no password.
            </p>
          )
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-red-500 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Team</th>
                <th className="py-2 pr-4" title="Booking offers a window when one of these people is free">Inspections</th>
                <th className="py-2 pr-4">Last sign-in</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.id}
                  className={`border-b border-gray-100 ${m.active ? "" : "opacity-50"}`}
                >
                  <td className="py-2.5 pr-4 font-semibold">
                    <Link href={`/admin/onboarding?member=${m.id}`} className="hover:underline" title="Onboarding">
                      {m.name}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600">{m.email}</td>
                  <td className="py-2.5 pr-4">
                    {/* Keyed on the saved value: React resets a form after its action,
                        and without a fresh key the menu snapped back to the old choice. */}
                    <form key={`role-${m.id}-${m.role}`} action={changeRole} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <select
                        name="role"
                        defaultValue={m.role}
                        className="rounded-md border border-[#d7dbe0] px-2 py-1 text-sm"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r.role} value={r.role}>
                            {r.label}
                          </option>
                        ))}
                        {m.role === "rep" ? <option value="rep">Rep (old)</option> : null}
                      </select>
                      <button className="text-xs font-semibold text-[#0c7a40] underline">
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="py-2.5 pr-4">
                    {m.active ? (
                      <form key={`team-${m.id}-${m.team_id ?? "none"}`} action={moveToTeam} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={m.id} />
                        <select
                          name="team"
                          defaultValue={m.team_id ?? ""}
                          className="rounded-md border border-[#d7dbe0] px-2 py-1 text-sm"
                          aria-label={`Team for ${m.name}`}
                        >
                          <option value="">No team</option>
                          {liveTeams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <button className="text-xs font-semibold text-[#0c7a40] underline">Save</button>
                      </form>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-4">
                    {m.active && m.role !== "setter" ? (
                      <form action={toggleInspections} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="to" value={m.takes_inspections ? "off" : "on"} />
                        <span className={m.takes_inspections ? "font-semibold text-[#0c7a40]" : "text-gray-500"}>
                          {m.takes_inspections ? "Takes them" : "No"}
                        </span>
                        <button className="text-xs font-semibold text-gray-500 underline">
                          {m.takes_inspections ? "Stop" : "Start"}
                        </button>
                      </form>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600">{when(m.last_login_at)}</td>
                  <td className="py-2.5 text-right">
                    {/*
                      Deactivate, never delete. Their name is on knocks, jobs
                      and signed agreements, and a signed contract has to keep
                      saying who wrote it.
                    */}
                    <form action={toggle}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="to" value={m.active ? "off" : "on"} />
                      <button className="text-xs font-semibold text-gray-500 underline">
                        {m.active ? "Turn off" : "Turn back on"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 id="teams" className="mt-10 scroll-mt-20 text-xs font-bold uppercase tracking-widest text-gray-500">
          Teams
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          A closer and the knockers who feed them. Each person sees their own numbers and their team&apos;s on the{" "}
          <Link href="/admin/scoreboard" className="font-semibold text-[#0c7a40] underline">
            scoreboard
          </Link>
          ; only admins see other teams and the company. Put people on a team in the table above.
        </p>
        {liveTeams.length ? (
          <ul className="mt-3 divide-y divide-gray-100 border-y border-gray-100">
            {liveTeams.map((t) => {
              const people = members.filter((m) => m.active && m.team_id === t.id);
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <form action={editTeam} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input
                      name="name"
                      defaultValue={t.name}
                      aria-label="Team name"
                      className="w-40 rounded-md border border-[#d7dbe0] px-2 py-1 text-[16px] font-semibold sm:text-sm"
                    />
                    <button className="text-xs font-semibold text-[#0c7a40] underline">Rename</button>
                  </form>
                  <span className="flex-1 text-sm text-gray-600">
                    {people.length
                      ? people.map((m) => `${m.name}${m.role === "closer" ? " (closer)" : ""}`).join(", ")
                      : "Nobody yet"}
                  </span>
                  <form action={editTeam}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="retire" value="1" />
                    <button className="text-xs font-semibold text-gray-500 underline">Retire</button>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : null}
        <form action={addTeam} className="mt-3 flex items-center gap-2">
          <input
            name="name"
            required
            placeholder="Team name, e.g. North"
            className="w-56 rounded-md border border-[#d7dbe0] px-3 py-2 text-[16px] sm:text-sm"
          />
          <button className="rounded-md bg-[#0b0e13] px-4 py-2 text-sm font-bold text-white">Add team</button>
        </form>

        <h2 id="goals" className="mt-10 scroll-mt-20 text-xs font-bold uppercase tracking-widest text-gray-500">
          Goals
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          What the{" "}
          <Link href="/admin/scoreboard" className="font-semibold text-[#0c7a40] underline">
            scoreboard
          </Link>{" "}
          measures each person against. Leave a box blank for the team default: {DEFAULT_GOALS.knocksWeek} doors and{" "}
          {DEFAULT_GOALS.setsWeek} inspections a week, {`$${DEFAULT_GOALS.signedMonth.toLocaleString("en-US")} revenue a month for closers.`}{" "}
          A day&apos;s goal is a fifth of the week&apos;s.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-3">Doors a week</th>
                <th className="py-2 pr-3">Inspections a week</th>
                <th className="py-2 pr-3">Revenue a month</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {members
                .filter((m) => m.active)
                .map((m) => {
                  const form = `goals-${m.id}`;
                  const box =
                    "w-28 rounded-md border border-[#d7dbe0] px-2 py-1.5 text-[16px] tabular-nums focus:border-[#0c7a40] focus:outline-none sm:text-sm";
                  const sells = m.role !== "setter";
                  const knocks = m.role !== "closer";
                  return (
                    <tr key={m.id} className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 font-semibold">
                    <Link href={`/admin/onboarding?member=${m.id}`} className="hover:underline" title="Onboarding">
                      {m.name}
                    </Link>
                  </td>
                      <td className="py-2.5 pr-3">
                        {knocks ? (
                          <input form={form} name="knocks" inputMode="numeric" defaultValue={m.goal_knocks_week ?? ""}
                            placeholder={String(DEFAULT_GOALS.knocksWeek)} className={box} aria-label={`Doors a week for ${m.name}`} />
                        ) : <span className="text-gray-400">Closer</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        {knocks ? (
                          <input form={form} name="sets" inputMode="numeric" defaultValue={m.goal_sets_week ?? ""}
                            placeholder={String(DEFAULT_GOALS.setsWeek)} className={box} aria-label={`Inspections a week for ${m.name}`} />
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3">
                        {sells ? (
                          <input form={form} name="signed" inputMode="numeric" defaultValue={m.goal_signed_month ?? ""}
                            placeholder={DEFAULT_GOALS.signedMonth.toLocaleString("en-US")} className={box} aria-label={`Revenue a month for ${m.name}`} />
                        ) : <span className="text-gray-400">Setter</span>}
                      </td>
                      <td className="py-2.5 text-right">
                        <form key={`goals-${m.id}-${m.goal_knocks_week}-${m.goal_sets_week}-${m.goal_signed_month}`} id={form} action={saveGoals}>
                          <input type="hidden" name="id" value={m.id} />
                          <button className="text-xs font-semibold text-[#0c7a40] underline">Save</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-xs font-bold uppercase tracking-widest text-gray-500">
          Add someone
        </h2>
        <form action={add} className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <label className={label} htmlFor="t-name">Name</label>
            <input id="t-name" name="name" required className={input} />
          </div>
          <div>
            <label className={label} htmlFor="t-email">Work email</label>
            <input id="t-email" name="email" type="email" required className={input} />
          </div>
          <div>
            <label className={label} htmlFor="t-role">Role</label>
            <select id="t-role" name="role" defaultValue="setter" className={input}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="t-team">Team</label>
            <select id="t-team" name="team" defaultValue="" className={input}>
              <option value="">No team yet</option>
              {liveTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700 sm:col-span-4">
            <input type="checkbox" name="welcome" defaultChecked className="mt-0.5 h-4 w-4 accent-[#0c7a40]" />
            <span>
              <strong className="text-[#0b0e13]">Email them a welcome and start onboarding.</strong> One tap signs them in to their checklist;
              reminders go out on days 1, 3, 6 and 10 until they finish, then the office takes over.
            </span>
          </label>
          <div className="sm:col-span-4">
            <button className="rounded-md bg-[#0c7a40] px-6 py-3 font-display font-bold text-white">
              Add them
            </button>
          </div>
        </form>

        <dl className="mt-6 space-y-1.5 text-sm text-gray-600">
          {ASSIGNABLE_ROLES.map((r) => (
            <div key={r.role}>
              <dt className="inline font-semibold text-[#0b0e13]">{r.label}: </dt>
              <dd className="inline">{r.what}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
