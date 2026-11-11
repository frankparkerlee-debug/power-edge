import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { FieldMap } from "@/components/FieldMap";

/**
 * The knock map: where reps work.
 *
 * It used to be the storm "command view", with stat tiles, a storm timeline,
 * a storm-days table and four rows of filters above the first door. That
 * page is now the office view at /admin/storms/office (admins). This one
 * opens on the doors.
 */
export const metadata: Metadata = {
  title: "Knock map",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function KnockMapPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; zip?: string; big?: string; view?: string }>;
}) {
  const { key, zip, big, view } = await searchParams;
  const user = await currentUser(key);

  if (!user) {
    return (
      <div className="min-h-screen bg-white px-6 py-10 text-[#0b0e13]">
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">Knock map</h1>
          <p className="mt-2 text-sm text-gray-600">
            <Link href="/login" className="font-semibold text-[#0c7a40] underline">
              Sign in
            </Link>{" "}
            with your work email to see the doors near you.
          </p>
        </div>
      </div>
    );
  }

  const safeZip = zip && /^\d{5}$/.test(zip.trim()) ? zip.trim() : undefined;

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#0b0e13]">
      <FieldMap
        initialZip={safeZip}
        initialView={
          view === "older" || view === "priority" ? view : view === "hail1" || (!view && big === "0") ? "hail1" : "hail2"
        }
      />
      {user.role === "admin" && (
        <p className="px-5 pb-6 text-xs text-gray-500">
          Storm tables, every filter and the homeowner export are in the{" "}
          <Link href="/admin/storms/office" className="font-semibold text-gray-700 underline">
            office view
          </Link>
          .
        </p>
      )}
    </div>
  );
}
