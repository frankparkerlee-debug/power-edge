import type { Metadata } from "next";
import { listLeads, dbEnabled } from "@/lib/db";

// Internal leads view — NOT indexed. Gated by ?key=<ADMIN_TOKEN>. It's a simple
// internal tool; the token is the same ADMIN_TOKEN used for the backfill route.
export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false },
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const adminToken = process.env.ADMIN_TOKEN;
  const authed = !!adminToken && key === adminToken;

  const wrap =
    "min-h-screen bg-white px-6 py-10 text-[#0b0e13]";

  if (!adminToken) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Leads</h1>
          <p className="mt-2 text-sm text-gray-600">
            Set an <code className="rounded bg-gray-100 px-1">ADMIN_TOKEN</code>{" "}
            environment variable to enable this view.
          </p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">Leads</h1>
          <p className="mt-1 text-sm text-gray-600">Enter your access key.</p>
          <form method="get" className="mt-4 flex gap-2">
            <input
              name="key"
              type="password"
              placeholder="Access key"
              className="flex-1 rounded-md border border-gray-300 px-4 py-2.5"
              autoFocus
            />
            <button
              type="submit"
              className="rounded-md bg-[#0b0e13] px-5 py-2.5 font-display font-bold text-white"
            >
              View
            </button>
          </form>
        </div>
      </div>
    );
  }

  const leads = await listLeads();

  return (
    <div className={wrap}>
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between border-b border-gray-200 pb-4">
          <h1 className="font-display text-2xl font-extrabold">
            Leads{" "}
            <span className="text-base font-semibold text-gray-500">
              ({leads.length})
            </span>
          </h1>
          {!dbEnabled() && (
            <span className="text-sm text-red-600">
              Supabase not configured — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
            </span>
          )}
        </div>

        {leads.length === 0 ? (
          <p className="mt-6 text-gray-600">No leads yet.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Address</th>
                  <th className="py-2 pr-4">Service</th>
                  <th className="py-2 pr-4">Solar</th>
                  <th className="py-2 pr-4">Signed up on</th>
                  <th className="py-2 pr-4">Message</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 align-top">
                    <td className="whitespace-nowrap py-2.5 pr-4 text-gray-500">
                      {fmt(l.created_at)}
                    </td>
                    <td className="py-2.5 pr-4 font-semibold">{l.name || "—"}</td>
                    <td className="whitespace-nowrap py-2.5 pr-4">
                      {l.phone ? (
                        <a href={`tel:${l.phone}`} className="text-[#0c7a40] hover:underline">
                          {l.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-4">{l.email || "—"}</td>
                    <td className="py-2.5 pr-4">{l.address || "—"}</td>
                    <td className="py-2.5 pr-4">{l.service || "—"}</td>
                    <td className="py-2.5 pr-4">{l.solar ? "☀️" : ""}</td>
                    <td className="py-2.5 pr-4 text-gray-500">{l.source || "—"}</td>
                    <td className="max-w-sm py-2.5 pr-4 text-gray-600">
                      {l.message || "—"}
                    </td>
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
