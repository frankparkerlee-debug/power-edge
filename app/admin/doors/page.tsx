import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import DoorList from "@/components/DoorList";

// Best doors: ranked by hail, wind and roof age. NOT indexed, team only.
export const metadata: Metadata = {
  title: "Best doors",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function DoorsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; near?: string; q?: string }>;
}) {
  const { key, near, q } = await searchParams;
  const user = await currentUser(key);

  if (!user) {
    return (
      <div className="min-h-screen bg-white px-6 py-10 text-[#0b0e13]">
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Best doors</h1>
          <p className="mt-2 text-sm text-gray-600">
            <Link href="/login" className="font-medium text-[#0c7a40] underline">
              Sign in
            </Link>{" "}
            to open this.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 pb-16 pt-5 text-[#0b0e13] md:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold">Best doors</h1>
        <p className="mt-1 text-sm text-gray-500">Ranked by hail, wind and roof age.</p>
        <DoorList adminKey={key ?? ""} initialNear={near ?? ""} initialQuery={q ?? ""} />
      </div>
    </div>
  );
}
