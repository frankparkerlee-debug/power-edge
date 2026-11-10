import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import {
  currentUser,
  listMembers,
  addMember,
  setMemberActive,
  setMemberRole,
  ASSIGNABLE_ROLES,
  type Role,
} from "@/lib/auth";

export const metadata: Metadata = { title: "Team | PowerEdge" };
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
  searchParams: Promise<{ key?: string; added?: string; error?: string }>;
}) {
  const { key, added, error } = await searchParams;
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

  const members = await listMembers();

  async function add(formData: FormData) {
    "use server";
    const r = await addMember({
      email: String(formData.get("email") || ""),
      name: String(formData.get("name") || ""),
      role: String(formData.get("role") || "setter") as Role,
    });
    revalidatePath("/admin/team");
    if (!r.ok) throw new Error(r.error);
  }

  async function toggle(formData: FormData) {
    "use server";
    await setMemberActive(
      Number(formData.get("id")),
      String(formData.get("to")) === "on",
    );
    revalidatePath("/admin/team");
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
          <p className="mt-4 rounded-md border border-[#0c7a40] bg-[#f0fbf4] p-3 text-sm font-semibold">
            Added. They sign in at /login with their work email, no password.
          </p>
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
                  <td className="py-2.5 pr-4 font-semibold">{m.name}</td>
                  <td className="py-2.5 pr-4 text-gray-600">{m.email}</td>
                  <td className="py-2.5 pr-4">
                    <form action={changeRole} className="flex items-center gap-2">
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

        <h2 className="mt-10 text-xs font-bold uppercase tracking-widest text-gray-500">
          Add someone
        </h2>
        <form action={add} className="mt-3 grid gap-3 sm:grid-cols-3">
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
          <div className="sm:col-span-3">
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
