import type { Metadata } from "next";
import { listAppointments } from "@/lib/scheduling";

// Internal inspection board — NOT indexed. Gated by ?key=<ADMIN_TOKEN>.
export const metadata: Metadata = {
  title: "Inspections",
  robots: { index: false, follow: false },
};

function when(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const adminToken = process.env.ADMIN_TOKEN;
  const authed = !!adminToken && key === adminToken;
  const wrap = "min-h-screen bg-white px-6 py-10 text-[#0b0e13]";

  if (!authed) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Inspections</h1>
          <p className="mt-2 text-sm text-gray-600">
            Add <code className="rounded bg-gray-100 px-1">?key=…</code> to view the board.
          </p>
        </div>
      </div>
    );
  }

  const rows = await listAppointments(200);
  const upcoming = rows.filter((r) => new Date(r.slot_start).getTime() > Date.now() - 2 * 3600 * 1000);

  return (
    <div className={wrap}>
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-2xl font-extrabold">Booked inspections</h1>
        <p className="mt-1 text-sm text-gray-600">
          {upcoming.length} upcoming · all times Dallas–Fort Worth
        </p>

        {upcoming.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            Nothing booked yet. Bookings land here the moment a homeowner picks a window at{" "}
            <code className="rounded bg-gray-100 px-1">/schedule</code>.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Homeowner</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Address</th>
                  <th className="py-2 pr-4">Source</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 align-top">
                    <td className="py-3 pr-4 font-semibold whitespace-nowrap">{when(r.slot_start)}</td>
                    <td className="py-3 pr-4">{r.name}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <a className="text-[#0c7a40] underline" href={`tel:${r.phone}`}>{r.phone}</a>
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{r.address || "—"}</td>
                    <td className="py-3 pr-4 text-gray-500">{r.source || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
