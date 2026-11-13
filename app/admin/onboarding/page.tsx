import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser, listMembers, listTeams } from "@/lib/auth";
import { piiReady } from "@/lib/pii";
import { PERMIT_CITIES, expiring, loadAllOnboarding, loadOnboarding, stepsFor } from "@/lib/onboarding";
import { AGREEMENT_STATUS, AGREEMENT_TITLE, AGREEMENT_VERSION, agreementSections } from "@/lib/repAgreement";
import { quizForClient } from "@/lib/onboardingQuiz";
import { localDay } from "@/lib/day";
import { Onboarding } from "@/components/Onboarding";
import { loadSends, sequenceStatus, split, startOnboarding, type SendRow } from "@/lib/onboardingSequence";
import { canKnock } from "@/lib/fieldReady";

/**
 * Onboarding.
 *
 * A rep sees their own "Getting started" checklist. An admin sees the board
 * (everyone's progress, what each person is stuck on, permits running out)
 * and can open any rep to sign off office steps or, for 1099s and payouts,
 * reveal a full SSN or account number (logged).
 */
export const metadata: Metadata = { title: "Getting started", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const DOCS = {
  door: { file: "09-knocker-door-script.pdf", name: "Knocker door script", why: "The open, the answers, and booking at the door." },
  app: { file: "10-using-the-app.pdf", name: "Using the app", why: "The knock map and the four taps at every door." },
  pay: { file: "11-how-you-get-paid.pdf", name: "How you get paid", why: "Your share, the $50 held inspection (homeowner there), when money lands." },
  field: { file: "12-closer-field-guide.pdf", name: "Closer field guide", why: "How the claim pays, and the adjuster line." },
  setter: { file: "01-setter-script.pdf", name: "Phone setter script", why: "Calling storm-hit homes that aren't on Do Not Call." },
  closer: { file: "02-closer-script.pdf", name: "Closer script", why: "Running the inspection and the honest verdict." },
  card: { file: "03-texas-compliance-card.pdf", name: "Texas compliance card", why: "The rules the check is built on. Keep it on you." },
  board: { file: "04-territory-board.pdf", name: "Storm territory board", why: "Where the storms hit and when." },
  intake: { file: "05-claim-intake-form.pdf", name: "Claim intake form", why: "What the homeowner needs to file their claim." },
  report: { file: "06-inspection-report.pdf", name: "Inspection report", why: "What you hand over after every inspection." },
  leave: { file: "07-homeowner-leave-behind.pdf", name: "How a roof claim works", why: "What the homeowner keeps after you leave." },
  repair: { file: "08-repair-agreement.pdf", name: "Repair agreement (paper)", why: "For no signal. The digital one in the Agreement tab comes first." },
};

function docsFor(role: string) {
  if (role === "setter") return [DOCS.door, DOCS.card, DOCS.app, DOCS.pay, DOCS.leave];
  if (role === "closer") return [DOCS.closer, DOCS.field, DOCS.card, DOCS.app, DOCS.pay, DOCS.report, DOCS.intake, DOCS.repair];
  return [DOCS.door, DOCS.closer, DOCS.field, DOCS.card, DOCS.app, DOCS.pay, DOCS.report, DOCS.intake, DOCS.leave, DOCS.repair];
}

const ROLE: Record<string, string> = { setter: "Knocker", closer: "Closer", rep: "Rep", admin: "Admin" };

/** What an onboarding email was, in words. */
function sendLabel(x: SendRow) {
  const k = x.key.split(":");
  switch (x.kind) {
    case "welcome":
      return "Welcome";
    case "reminder":
      return `Reminder ${k[2] ?? ""}`;
    case "gate":
      return k[1] === "agreement" ? "Agreement ready to sign" : "W-9 and direct deposit opened";
    case "permit":
      return `${k[1]} permit ${k[3] === "expired" ? "expired" : `expires in ${k[3]} days`}`;
    case "ready":
      return "You're all set";
    case "office_turn":
      return "To the office: your turn";
    case "office_stalled":
      return "To the office: gone quiet";
    default:
      return x.kind;
  }
}

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const STATUS_TONE: Record<string, string> = {
  stalled: "text-[#b42318] font-semibold",
  unsent: "text-[#b42318] font-semibold",
  waiting: "text-[#7a4b00]",
  done: "text-[#0c7a40] font-semibold",
};

async function sendWelcome(formData: FormData) {
  "use server";
  const me = await currentUser();
  if (me?.role !== "admin") return;
  const id = Number(formData.get("id"));
  const r = await startOnboarding(id);
  revalidatePath("/admin/onboarding");
  redirect(`/admin/onboarding?member=${id}&welcome=${r.ok ? "sent" : "failed"}`);
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; step?: string; welcome?: string }>;
}) {
  const { member, step, welcome } = await searchParams;
  const user = await currentUser();
  if (!user) {
    return (
      <div className="px-5 py-10">
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">Getting started</h1>
          <p className="mt-2 text-sm text-gray-600">
            <Link href="/login" className="font-semibold text-[#0c7a40] underline">Sign in</Link> with your work email.
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const today = localDay(new Date().toISOString());

  /* ------------------------------------------------------- the office board */
  if (isAdmin && !member) {
    const [members, teams, all, sends] = await Promise.all([listMembers(), listTeams(), loadAllOnboarding(), loadSends()]);
    const people = members.filter((m) => m.active && m.role !== "admin");
    const rows = people.map((m) => {
      const steps = stepsFor({
        onb: all.onb.get(m.id) ?? null,
        tax: all.tax.has(m.id) ? { member_id: m.id } : null,
        bank: all.bank.has(m.id) ? { member_id: m.id } : null,
        permits: all.permits.filter((p) => p.member_id === m.id),
      });
      const seq = sequenceStatus(m, steps, sends.filter((x) => x.member_id === m.id));
      // Next is the first step someone can act on: a step that hasn't opened
      // yet (a draft agreement) is skipped in favor of the office's.
      const sp = split(steps);
      const next = sp.open[0] ?? sp.office[0] ?? steps.find((s) => !s.done);
      return { m, steps, seq, next, done: steps.filter((s) => s.done).length };
    });
    rows.sort((a, b) => a.done - b.done || a.m.name.localeCompare(b.m.name));
    const soon = expiring(all.permits, today);
    const nameOf = new Map(members.map((m) => [m.id, m.name]));

    return (
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="font-display text-2xl font-extrabold text-[#0b0e13]">Onboarding</h1>
          <p className="mt-1 text-sm text-gray-600">
            Everyone between hired and knocking, and what each person is waiting on. Add people on the{" "}
            <Link href="/admin/team" className="font-semibold text-[#0c7a40] underline">Team page</Link>; their welcome email goes out
            then, and reminders run on their own.{" "}
            <Link href="/admin/onboarding/emails" className="font-semibold text-[#0c7a40] underline">See the emails</Link>
          </p>

          {!piiReady() ? (
            <p className="mt-4 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Secure storage is off.</strong> Reps can&apos;t enter their W-9 or bank details until PII_KEY is set in Render.
            </p>
          ) : null}
          {AGREEMENT_STATUS === "draft" ? (
            <p className="mt-3 rounded-md border border-[#e3e6ea] bg-white p-3 text-sm text-gray-700">
              <strong className="text-[#0b0e13]">The contractor agreement is a draft</strong> ({AGREEMENT_VERSION}). Reps can read it but not sign until
              counsel clears it and it is switched to final. Open any rep below to read it.
            </p>
          ) : null}

          {soon.length ? (
            <section className="mt-6">
              <h2 className="font-display text-lg font-bold text-[#0b0e13]">Permits running out</h2>
              <ul className="mt-2 divide-y divide-[#eceef1] rounded-lg border border-[#e3e6ea] bg-white">
                {soon.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                    <span><strong className="text-[#0b0e13]">{nameOf.get(p.member_id)}</strong> · {p.city}</span>
                    <span className={p.days < 0 ? "font-semibold text-[#b42318]" : "text-[#7a4b00]"}>
                      {p.days < 0 ? `Expired ${-p.days} days ago` : p.days === 0 ? "Expires today" : `Expires in ${p.days} days`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-6">
            <h2 className="font-display text-lg font-bold text-[#0b0e13]">People</h2>
            {rows.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-600">
                Nobody to onboard yet. Add your new reps on the Team page.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-[#eceef1] rounded-lg border border-[#e3e6ea] bg-white">
                {rows.map(({ m, steps, seq, next, done }) => (
                  <li key={m.id}>
                    <Link href={`/admin/onboarding?member=${m.id}`} className="block px-4 py-3 hover:bg-[#f7f8f9]">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-semibold text-[#0b0e13]">
                          {m.name}
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            {ROLE[m.role] ?? m.role}
                            {m.team_id ? ` · ${teams.find((t) => t.id === m.team_id)?.name ?? ""}` : ""}
                          </span>
                        </span>
                        <span className={`text-sm ${done === steps.length ? "font-semibold text-[#0c7a40]" : "text-gray-500"}`}>
                          {done < steps.length && canKnock(steps) ? (
                            <span className="mr-2 rounded-full bg-[#f0fbf4] px-2 py-0.5 text-xs font-semibold text-[#0c7a40]">
                              Can knock
                            </span>
                          ) : null}
                          {done === steps.length ? "Ready" : `${done} of ${steps.length}`}
                        </span>
                      </div>
                      <div className="mt-1.5 flex gap-1" aria-hidden>
                        {steps.map((s) => (
                          <span key={s.key} title={s.label} className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-[#0c7a40]" : "bg-[#e3e6ea]"}`} />
                        ))}
                      </div>
                      <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-gray-500">
                        <span>
                          {next ? `Next: ${next.label}${next.by === "office" ? " (you)" : ""}` : ""}
                        </span>
                        <span className={STATUS_TONE[seq.state] ?? ""}>
                          {seq.state === "done" ? "" : seq.label}
                          {seq.failed.length ? " · an email failed" : ""}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------ one person's checklist */
  const targetId = isAdmin && member ? Number(member) : user.id;
  const members = isAdmin ? await listMembers() : [];
  const target = isAdmin ? members.find((m) => m.id === targetId) : { id: user.id, name: user.name, role: user.role };
  if (!target) {
    return (
      <div className="px-5 py-10">
        <p className="text-sm text-gray-600">Nobody by that id. <Link href="/admin/onboarding" className="underline">Back to onboarding</Link></p>
      </div>
    );
  }
  const [d, mySends] = await Promise.all([loadOnboarding(target.id), isAdmin ? loadSends(target.id) : Promise.resolve([] as SendRow[])]);
  const steps = stepsFor(d);
  const o = d.onb;
  const self = target.id === user.id;
  const full = isAdmin ? members.find((m) => m.id === target.id) : null;
  const seq = full ? sequenceStatus(full, steps, mySends) : null;

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl">
        {isAdmin ? (
          <Link href="/admin/onboarding" className="text-sm font-semibold text-gray-500 hover:text-[#0b0e13]">Onboarding</Link>
        ) : null}
        <h1 className="font-display text-2xl font-extrabold text-[#0b0e13]">
          {self ? "Getting started" : target.name}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {self
            ? "Steps 1 to 5 open the knock map. City permits don't hold up your first door. Do it on your phone; it saves as you go."
            : `${ROLE[target.role] ?? target.role}. What they've done, and the steps that are yours.`}
        </p>
        <div className="mt-5">
          <Onboarding
            memberId={target.id}
            name={target.name}
            role={target.role}
            self={self}
            office={isAdmin}
            steps={steps}
            profile={{
              legal_name: o?.legal_name ?? (self ? user.name : ""),
              phone: o?.phone ?? "",
              address: o?.address ?? "",
              city: o?.city ?? "",
              state: o?.state ?? "TX",
              zip: o?.zip ?? "",
              emergency_name: o?.emergency_name ?? "",
              emergency_phone: o?.emergency_phone ?? "",
              shirt_size: o?.shirt_size ?? "",
              photo_jpeg: o?.photo_jpeg ?? "",
            }}
            agreement={{
              status: AGREEMENT_STATUS,
              version: AGREEMENT_VERSION,
              title: AGREEMENT_TITLE,
              sections: agreementSections(o?.legal_name || target.name, target.role),
              signedAt: o?.agreement_signed_at ?? null,
              signedName: o?.agreement_typed_name ?? null,
            }}
            tax={{ on: !!d.tax, last4: d.tax?.tin_last4 ?? null, type: d.tax?.tin_type ?? null, name: d.tax?.certified_name ?? null, at: d.tax?.certified_at ?? null }}
            bank={{ on: !!d.bank, last4: d.bank?.account_last4 ?? null, routing: d.bank?.routing ?? null, type: d.bank?.account_type ?? null, at: d.bank?.authorized_at ?? null }}
            training={{ playbookRead: !!o?.playbook_read_at, passed: !!o?.quiz_passed_at, attempts: o?.quiz_attempts ?? 0, best: o?.quiz_best ?? null }}
            quiz={quizForClient()}
            docs={docsFor(target.role)}
            permits={d.permits.map((p) => ({ city: p.city, status: p.status, permit_number: p.permit_number, expires_on: p.expires_on, photo_jpeg: p.photo_jpeg }))}
            cities={PERMIT_CITIES}
            officeInfo={{ rideAlongBy: o?.ride_along_by ?? null, gearBy: o?.gear_by ?? null, notes: o?.office_notes ?? "" }}
            piiReady={piiReady()}
            initialStep={step ?? null}
          />
        </div>

        {isAdmin && !self && full && seq ? (
          <section className="mt-8 rounded-lg border border-[#e3e6ea] bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-[#0b0e13]">Onboarding emails</h2>
              <span className={`text-sm ${STATUS_TONE[seq.state] ?? "text-gray-600"}`}>{seq.label}</span>
            </div>
            {welcome === "sent" ? (
              <p className="mt-2 text-sm font-semibold text-[#0c7a40]">Welcome sent. Reminders start over from today.</p>
            ) : welcome === "failed" ? (
              <p className="mt-2 text-sm font-semibold text-[#b42318]">The welcome didn&apos;t send. Check Health for mail errors, then try again.</p>
            ) : null}
            {mySends.length ? (
              <ul className="mt-3 divide-y divide-[#eceef1] text-sm">
                {mySends.map((x) => (
                  <li key={x.id} className="flex flex-wrap justify-between gap-x-3 py-2">
                    <span className="text-[#0b0e13]">
                      {sendLabel(x)}
                      {x.ok === false ? <span className="ml-2 font-semibold text-[#b42318]">Didn&apos;t send</span> : null}
                    </span>
                    <span className="text-gray-500">{stamp(x.sent_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-600">No onboarding emails yet.</p>
            )}
            <form action={sendWelcome} className="mt-3">
              <input type="hidden" name="id" value={full.id} />
              <button className="rounded-md border border-[#0c7a40] px-4 py-2 text-sm font-semibold text-[#0c7a40]">
                {full.onboarding_started_at ? "Send the welcome again" : "Start onboarding emails"}
              </button>
              <span className="ml-3 text-xs text-gray-500">Sends a fresh sign-in button and starts the reminders over.</span>
            </form>
          </section>
        ) : null}
      </div>
    </div>
  );
}
