import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { listRepAreas, listTargetCities, assignArea, unassignArea } from "@/lib/parcels";
import { currentUser } from "@/lib/auth";

// Territory board. NOT indexed. requires a signed-in team member.
export const metadata: Metadata = {
  title: "Territories",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function TerritoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const user = await currentUser(key);
  const authed = user?.role === "admin";
  const wrap = "min-h-screen bg-white px-6 py-10 text-[#0b0e13]";

  if (!authed) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Territories</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to open this.
          </p>
        </div>
      </div>
    );
  }

  const [areas, cities] = await Promise.all([listRepAreas(), listTargetCities()]);
  const ownerOf = new Map(areas.map((a) => [`${a.area_kind}:${a.area_value.toLowerCase()}`, a]));

  async function assign(formData: FormData) {
    "use server";
    const rep = String(formData.get("rep") || "").trim();
    const city = String(formData.get("city") || "").trim();
    if (rep && city) await assignArea(rep, "city", city);
    revalidatePath("/admin/territories");
  }

  async function clear(formData: FormData) {
    "use server";
    const id = Number(formData.get("id"));
    if (Number.isFinite(id)) await unassignArea(id);
    revalidatePath("/admin/territories");
  }

  // Cities worth assigning: the ones with real volume, biggest first.
  const assignable = cities
    .filter((c) => c.city && c.targets >= 40 && !/TIF|SUBDIST|ZONE|County/i.test(c.city))
    .sort((a, b) => b.targets - a.targets);

  const byRep = new Map<string, typeof areas>();
  for (const a of areas) {
    const list = byRep.get(a.rep) || [];
    list.push(a);
    byRep.set(a.rep, list);
  }

  return (
    <div className={wrap}>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-extrabold">Territories</h1>
        <p className="mt-1 text-sm text-gray-600">
          One city, one rep. Assigning a city that already has an owner moves it.
          Reps sign in and open the knock tool at{" "}
          <code className="rounded bg-gray-100 px-1">/admin/storms</code>{" "}
          and it opens on their own cities.
        </p>

        {byRep.size > 0 && (
          <>
            <h2 className="mt-8 text-xs font-bold uppercase tracking-widest text-gray-500">
              Assigned
            </h2>
            <div className="mt-3 space-y-3">
              {[...byRep.entries()].map(([rep, list]) => (
                <div key={rep} className="rounded-lg border border-gray-200 p-4">
                  <div className="font-bold">{rep}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {list.map((a) => (
                      <form key={a.id} action={clear}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="rounded-full border border-gray-300 px-3 py-1 text-sm hover:border-red-400 hover:text-red-600">
                          {a.area_value} ✕
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="mt-8 text-xs font-bold uppercase tracking-widest text-gray-500">
          Assign a city
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="py-2 pr-4">City</th>
                <th className="py-2 pr-4">Homes</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2">Assign to</th>
              </tr>
            </thead>
            <tbody>
              {assignable.map((c) => {
                const owner = ownerOf.get(`city:${c.city.toLowerCase()}`);
                return (
                  <tr key={`${c.county}-${c.city}`} className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 font-semibold">{c.city}</td>
                    <td className="py-2.5 pr-4">{c.targets.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{owner?.rep || "—"}</td>
                    <td className="py-2.5">
                      <form action={assign} className="flex gap-2">
                        <input type="hidden" name="city" value={c.city} />
                        <input
                          name="rep"
                          placeholder="Rep name"
                          className="w-36 rounded border border-gray-300 px-2 py-1"
                        />
                        <button className="rounded bg-[#0c7a40] px-3 py-1 font-semibold text-white">
                          Set
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
