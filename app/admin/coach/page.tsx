import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { Coach } from "@/components/coach/Coach";
import { PERSONAS } from "@/lib/coach/personas";

/**
 * Coach: practice doors out loud on real houses, ask the playbook, find the
 * best streets. Open to everyone on the team, including reps still getting
 * started: practice is how they get ready for the first door.
 */
export const metadata: Metadata = {
  title: "Coach",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lon?: string; a?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const user = await currentUser();
  if (!user) {
    return (
      <div className="min-h-screen bg-white px-6 py-10 text-[#0b0e13]">
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">Coach</h1>
          <p className="mt-2 text-sm text-gray-600">
            <Link href="/login" className="font-semibold text-[#0c7a40] underline">
              Sign in
            </Link>{" "}
            with your work email to practice doors.
          </p>
        </div>
      </div>
    );
  }

  const lat = Number(sp.lat), lon = Number(sp.lon);
  const door =
    Number.isFinite(lat) && Number.isFinite(lon) && sp.lat && sp.lon
      ? { lat, lon, address: String(sp.a || "").slice(0, 160) }
      : null;
  const tab = sp.tab === "ask" || sp.tab === "doors" ? sp.tab : "practice";
  // Labels only: who's behind each door stays on the server.
  const personas = PERSONAS.map((p) => ({ id: p.id, label: p.label }));

  return <Coach initialDoor={door} initialTab={tab} personas={personas} />;
}
