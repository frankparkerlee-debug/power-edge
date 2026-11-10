import type { Metadata } from "next";
import { ContractForm } from "@/components/ContractForm";
import { listContracts } from "@/lib/contracts";
import { currentUser, canSell } from "@/lib/auth";
import { getJob } from "@/lib/jobs";
import { money } from "@/lib/money";

// Field agreement. NOT indexed. requires a signed-in team member.
export const metadata: Metadata = {
  title: "Agreement",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** A real timestamp, shown in the timezone the crew works in. */
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

/**
 * A calendar date with no time in it, such as cancel_deadline, which Postgres
 * hands back as "2026-11-13".
 *
 * Passing that through when() parsed it as UTC midnight and then printed it in
 * Chicago, six hours earlier, so every cancellation deadline on this table
 * showed a day early: the database said Friday the 13th and the screen said
 * Nov 12. The homeowner's emailed copy was right, which is what kept this from
 * being a legal problem, but a rep reading this table would have told someone
 * the wrong date over the phone. Split the day out of the string instead of
 * letting a timezone touch it at all.
 */
function whenDate(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return when(ymd);
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
}

export default async function ContractPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; rep?: string; job?: string }>;
}) {
  const { key, rep, job } = await searchParams;
  const user = await currentUser(key);
  const authed = !!user;
  const wrap = "min-h-screen bg-white px-5 py-8 text-[#0b0e13] sm:px-6";

  if (!authed) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Agreement</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to open this.
          </p>
        </div>
      </div>
    );
  }

  /*
   * Setters do not write agreements.
   *
   * Hiding the tab is not the same as closing the door: the URL is guessable
   * and a setter who lands here could put an unpriced contract in front of a
   * homeowner. Pricing and paper belong to the closer.
   */
  if (!canSell(user.role)) {
    return (
      <div className={wrap}>
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Agreement</h1>
          <p className="mt-2 text-sm text-gray-600">
            Agreements are written by closers. Book the inspection and the closer
            prices it from there.
          </p>
          <a
            href="/admin/appointments"
            className="mt-4 inline-block rounded-md bg-[#0c7a40] px-4 py-2.5 font-bold text-white"
          >
            Go to inspections
          </a>
        </div>
      </div>
    );
  }

  const recent = await listContracts(10);

  /*
   * Opened from a job, the agreement starts filled in.
   *
   * "Write agreement" on a job record used to link to a blank form, so a
   * closer looking at the homeowner's name, address, phone, email, carrier
   * and claim number typed all six again into the next screen. Everything
   * here is already ours.
   */
  const j = job ? await getJob(job) : null;
  const prefill = j
    ? {
        owner: j.owner_name ?? "",
        phone: j.phone ?? "",
        email: j.email ?? "",
        address: j.address ?? "",
        carrier: j.carrier ?? "",
        claimNumber: j.claim_number ?? "",
        deductible: j.deductible ?? "",
        claimBased: j.job_type !== "cash",
        squares: j.squares != null ? String(j.squares) : "",
      }
    : undefined;

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
          <ContractForm
            repDefault={rep || user.name || ""}
            prefill={prefill}
            jobId={j?.id}
          />
        </div>

        {recent.length > 0 && (
          <>
            <h2 className="mt-12 text-xs font-bold uppercase tracking-widest text-gray-500">
              Recent agreements
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="py-2 pr-4">Written</th>
                    <th className="py-2 pr-4">Homeowner</th>
                    <th className="py-2 pr-4">Property</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2">Status</th>
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
                      <td className="py-2.5 pr-4 whitespace-nowrap">{money(c.total_price)}</td>
                      <td className="py-2.5 whitespace-nowrap">
                        {/*
                          This column used to print the cancellation deadline
                          and nothing else, under a heading that said these
                          were all signed. They are not: listContracts returns
                          drafts that have been sent and not signed, and those
                          have no deadline yet, so the cell read "Invalid
                          Date". An unsigned agreement sitting out there is the
                          thing a closer most needs to see, so say which it is.
                        */}
                        {c.canceled_at ? (
                          <span className="font-semibold text-red-600">Cancelled</span>
                        ) : String(c.status) !== "signed" && !c.emailed_at ? (
                          /*
                            Written, but nobody has it. The first agreement
                            through this flow sat in this state for twenty
                            minutes and nothing on any screen said so: the
                            table called it "signed", the rep had been handed
                            a link to text by hand, and the homeowner had
                            never heard of it.
                          */
                          <span className="font-semibold text-red-600">
                            Not sent to them
                          </span>
                        ) : String(c.status) !== "signed" ? (
                          <span className="font-semibold text-[#b54708]">
                            Awaiting signature
                          </span>
                        ) : c.cancel_deadline ? (
                          <span className="text-gray-700">
                            Can cancel to {whenDate(String(c.cancel_deadline))}
                          </span>
                        ) : (
                          <span className="font-semibold text-green-700">Signed</span>
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
