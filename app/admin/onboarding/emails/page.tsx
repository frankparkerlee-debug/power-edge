import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import {
  onbGate,
  onbOfficeStalled,
  onbOfficeTurn,
  onbPermit,
  onbReady,
  onbReminder,
  onbWelcome,
  type OnbCtx,
  type OnbEmail,
} from "@/lib/emails";
import { REMINDER_DAYS } from "@/lib/onboardingSequence";

/**
 * Every email in the onboarding sequence, as it sends, with a made-up rep.
 * Nothing here sends anything.
 */
export const metadata: Metadata = { title: "Onboarding emails", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const base: OnbCtx = {
  first: "Jordan",
  name: "Jordan Reyes",
  role: "Knocker",
  team: "North",
  url: "#",
  open: [
    { label: "Your details and badge photo", time: "About 5 minutes" },
    { label: "Tax form (W-9)", time: "About 3 minutes" },
    { label: "Direct deposit", time: "About 2 minutes" },
    { label: "Playbook and compliance check", time: "About 20 minutes" },
    { label: "City permits", time: "Depends on the city; the checklist says how" },
  ],
  blocked: [{ label: "Sign your contractor agreement", why: "opens once the office finalizes it; we'll email you" }],
  done: 0,
  total: 8,
  officeOpen: ["Ride-along with a lead", "Badge, shirt and print kit"],
};

const later: OnbCtx = { ...base, done: 3, open: base.open.slice(3) };

type Item = { id: string; when: string; to: "Rep" | "Office"; email: OnbEmail };

const ITEMS: Item[] = [
  { id: "welcome", when: "The moment you add them on the Team page", to: "Rep", email: onbWelcome(base) },
  { id: "r1", when: `Day ${REMINDER_DAYS[0]}, if anything's left and they've been quiet ~20 hours`, to: "Rep", email: onbReminder({ ...base, reminders: 1 }) },
  { id: "r2", when: `Day ${REMINDER_DAYS[1]}, same rule`, to: "Rep", email: onbReminder({ ...later, reminders: 2 }) },
  { id: "r3", when: `Day ${REMINDER_DAYS[2]}, same rule`, to: "Rep", email: onbReminder({ ...later, reminders: 3 }) },
  { id: "r4", when: `Day ${REMINDER_DAYS[3]}, the last one`, to: "Rep", email: onbReminder({ ...later, reminders: 4 }) },
  {
    id: "stalled",
    when: "Two days after the last reminder, if they still haven't finished",
    to: "Office",
    email: onbOfficeStalled({ ...later, reminders: 4, since: "Wed, Nov 11", lastActivity: "Thu, Nov 12", phone: "(214) 555-0142" }),
  },
  { id: "turn", when: "When they've done everything on their side", to: "Office", email: onbOfficeTurn({ ...base, open: [], done: 6 }) },
  { id: "agreement", when: "When the agreement goes final, if they started before it was", to: "Rep", email: onbGate(later, "agreement") },
  { id: "secure", when: "When the W-9 and bank steps open, if they started before", to: "Rep", email: onbGate(later, "secure") },
  { id: "ready", when: "When all 8 steps are done", to: "Rep", email: onbReady({ ...base, open: [], blocked: [], done: 8, permitsHeld: ["Dallas", "Garland"] }) },
  {
    id: "permit",
    when: "14 days and 3 days before a permit expires, and the day after it does",
    to: "Rep",
    email: onbPermit({
      ...base,
      permit: {
        city: "Dallas",
        expires: "December 2",
        days: 14,
        how: "In person at DPD, 1400 S. Lamar, 8am to 3pm weekdays. $50, 2x2 photo, ID card mailed within 30 days, good 1 year.",
      },
    }),
  },
];

export default async function OnboardingEmailsPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const user = await currentUser();
  if (user?.role !== "admin") {
    return (
      <div className="px-5 py-10">
        <p className="text-sm text-gray-600">Only the office can see this.</p>
      </div>
    );
  }
  const selected = ITEMS.find((i) => i.id === e) ?? ITEMS[0];

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/onboarding" className="text-sm font-semibold text-gray-500 hover:text-[#0b0e13]">
          Onboarding
        </Link>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-[#0b0e13]">Onboarding emails</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          What a new rep and the office get, and when. These go on their own; nothing on this page sends. Shown with a made-up rep.
          Emails go out between 8am and 7pm Central.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <ul className="divide-y divide-[#eceef1] self-start rounded-lg border border-[#e3e6ea] bg-white">
            {ITEMS.map((i) => {
              const on = i.id === selected.id;
              return (
                <li key={i.id}>
                  <Link
                    href={`/admin/onboarding/emails?e=${i.id}`}
                    scroll={false}
                    className={`block px-4 py-3 ${on ? "bg-[#f3faf6]" : "hover:bg-[#f7f8f9]"}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-[#0b0e13]">{i.email.subject}</span>
                      <span className={`shrink-0 text-xs ${i.to === "Office" ? "font-semibold text-[#7a4b00]" : "text-gray-500"}`}>{i.to}</span>
                    </div>
                    <div className="text-xs text-gray-500">{i.when}</div>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div>
            <div className="text-sm text-gray-600">
              To <strong className="text-[#0b0e13]">{selected.to === "Office" ? "every admin" : "the rep"}</strong> · {selected.when}
              <br />
              Subject: <strong className="text-[#0b0e13]">{selected.email.subject}</strong>
            </div>
            <iframe
              title={selected.email.subject}
              srcDoc={selected.email.html}
              sandbox=""
              className="mt-3 h-[56rem] w-full rounded-lg border border-[#e3e6ea] bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
