import type { Metadata } from "next";
import { ContractForm } from "@/components/ContractForm";
import { listContracts } from "@/lib/contracts";

// Field agreement. NOT indexed. Gated by ?key=<ADMIN_TOKEN>.
export const metadata: Metadata = {
  title: "Agreement",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function when(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function ContractPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; rep?: string }>;
}) {
  const { key, rep } = await searchParams;
  const adminToken = process.env.ADMIN_TOKEN;
  const authed = !!adminToken && key === adminToken;
  const wrap = "min-h-screen bg-white px-5 py-8 text-[#0b0e13] sm:px-6";

  if (!authed) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Agreement</h1>
          <p className="mt-2 text-sm text-gray-600">
            Add <code className="rounded bg-gray-100 px-1">?key=…</code> to use this.
          </p>
        </div>
      </div>
    );
  }

  const recent = await listContracts(10);

  return (
    <div className={wrap}>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-extrabold">Residential repair agreement</h1>
        <p className="mt-1 text-sm text-gray-600">
          Fill this in with the homeowner. They sign on the screen and get their
          copy, with their cancellation rights, by email before you leave the
          driveway.
        </p>

        <div className="mt-6">
          <ContractForm repDefault={rep || ""} />
        </div>

        {recent.length > 0 && (
          <>
            <h2 className="mt-12 text-xs font-bold uppercase tracking-widest text-gray-500">
              Recently signed
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="py-2 pr-4">Signed</th>
                    <th className="py-2 pr-4">Homeowner</th>
                    <th className="py-2 pr-4">Property</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2">Cancel by</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c) => (
                    <tr key={String(c.id)} className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        {when(String(c.created_at))}
                      </td>
                      <td className="py-2.5 pr-4">{String(c.owner_names)}</td>
                      <td className="py-2.5 pr-4 text-gray-600">
                        {String(c.property_address)}
                      </td>
                      <td className="py-2.5 pr-4">{String(c.total_price ?? "")}</td>
                      <td className="py-2.5 whitespace-nowrap">
                        {c.canceled_at ? (
                          <span className="font-semibold text-red-600">Cancelled</span>
                        ) : (
                          when(String(c.cancel_deadline))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
