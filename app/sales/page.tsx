import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";
import { currentUser } from "@/lib/auth";

// Internal sales repo. NOT indexed. Requires a signed-in admin.
// Reps open this on a phone in a driveway, so it has to work at 375px and load
// without a login round-trip. Everything here is also a PDF they can print.
export const metadata: Metadata = {
  title: "Sales Repo",
  robots: { index: false, follow: false, nocache: true },
};

type Doc = {
  file: string;
  name: string;
  who: "Setter" | "Closer" | "Both" | "Homeowner";
  what: string;
};

/** Unreviewed legal paper: the office only, until counsel clears it. */
const DRAFT_ONLY = new Set(["08-repair-agreement.pdf"]);

const DOCS: Doc[] = [
  {
    file: "01-setter-script.pdf", name: "Setter call script", who: "Setter",
    what: "The open, the branches, seven objections, and what good numbers look like. Built around leading with the real storm date and hail size for that address.",
  },
  {
    file: "02-closer-script.pdf", name: "Closer field script", who: "Closer",
    what: "Booked inspection and cold door, what to photograph on the roof, and how to deliver the verdict both ways. Seven objections including the deductible-waiver competitor.",
  },
  {
    file: "03-texas-compliance-card.pdf", name: "Texas compliance card", who: "Both",
    what: "The three rules that can end the company: the deductible, the adjuster line, and the licensing claim. Keep a copy in the truck.",
  },
  {
    file: "04-territory-board.pdf", name: "Storm territory board", who: "Both",
    what: "Every verified storm-hit city with home counts, dialable counts after the DNC scrub, hail size, and storm dates. Generated from the live database.",
  },
  {
    file: "05-claim-intake-form.pdf", name: "Insurance claim intake", who: "Closer",
    what: "Paper twin of the online claim prep. Carrier, policy, deductible, date of loss, mortgage company.",
  },
  {
    file: "06-inspection-report.pdf", name: "Roof inspection report", who: "Closer",
    what: "Test squares, soft metals, non-storm conditions, and the written verdict. Fill one out on every inspection, including the no-claim ones.",
  },
  {
    file: "07-homeowner-leave-behind.pdf", name: "How a roof claim works", who: "Homeowner",
    what: "The one-pager you hand over. Explains the claim process, the deductible law, and the questions to ask any roofer. Leave it even when you don't get the job.",
  },
  {
    file: "08-repair-agreement.pdf", name: "Residential repair agreement", who: "Closer",
    what: "The paper contract, two pages, with the deductible notice and both detachable cancellation notices. Prefer the digital version below; use this when there is no signal.",
  },
];

const TOOLS = [
  { href: "/admin/storms", name: "Storm tool", what: "The knock map. Addresses, owners, hail size, tap to call, convert to lead." },
  { href: "/admin/appointments", name: "Inspection board", what: "Everything booked from the website." },
  { href: "/admin/territories", name: "Territories", what: "Who owns which city. One city, one rep." },
  { href: "/admin/contract", name: "Sign an agreement", what: "The digital contract. Fill it in with the homeowner, they sign on your screen, their copy and cancellation rights are emailed before you leave." },
  { href: "/admin/health", name: "Health", what: "Is email actually delivering, is the storm feed alive, what is booked. Check it if leads go quiet." },
  { href: "/schedule", name: "Book an inspection", what: "Send this link to a homeowner. They pick their own window." },
  { href: "/roof-claim-check", name: "Claim check", what: "60-second address check. Good door opener." },
  { href: "/review", name: "Review link", what: "Text this after a finished job." },
  { href: "/kit", name: "Door-knock QR kit", what: "Printable QR cards with per-rep tracking. Add ?rep=YourName." },
  { href: "/agreement", name: "Inspection agreement (live)", what: "The public terms a homeowner accepts when they book online. Authorizes no work and no payment. Send it to anyone who asks what they are signing." },
];

export default async function SalesRepoPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const user = await currentUser(key);
  // Every signed-in team member: this is their playbook. It was admin-only
  // after sign-in replaced the shared key, so reps tapping Playbook were told
  // to sign in while signed in.
  const authed = !!user;
  const isAdmin = user?.role === "admin";

  if (!authed) {
    return (
      <div className="min-h-screen bg-ink px-6 py-16">
        <div className="mx-auto max-w-sm text-center">
          <h1 className="font-display text-2xl font-extrabold text-fg-inv">Sales repo</h1>
          <p className="mt-3 text-sm text-fg-inv-dim">
            This page is for the PowerEdge team.{" "}
            <a href="/login" className="font-semibold text-bolt underline">Sign in</a>{" "}
            to open it.
          </p>
        </div>
      </div>
    );
  }

  const badge = (who: Doc["who"]) =>
    who === "Setter" ? "bg-bolt/15 text-bolt"
    : who === "Closer" ? "bg-sky-400/15 text-sky-300"
    : who === "Homeowner" ? "bg-amber-400/15 text-amber-300"
    : "bg-white/10 text-fg-inv-dim";

  return (
    <div className="min-h-screen bg-ink px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-extrabold leading-tight text-fg-inv">
          Sales repo
        </h1>
        <p className="mt-2 text-fg-inv-dim">
          Everything a setter or closer needs. Read it here on your phone, or print the PDF.
        </p>

        <h2 className="mt-10 text-xs font-bold uppercase tracking-widest text-fg-inv-dim">
          Documents
        </h2>
        <div className="mt-4 space-y-3">
          {DOCS.filter((d) => isAdmin || !DRAFT_ONLY.has(d.file)).map((d) => (
            <a
              key={d.file}
              href={`/sales/doc/${d.file}`}
              target="_blank"
              rel="noopener"
              className="block rounded-card border border-line bg-ink-2 p-5 transition-colors hover:border-bolt"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-bold text-fg-inv">{d.name}</span>
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge(d.who)}`}>
                  {d.who}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-inv-dim">{d.what}</p>
              <span className="mt-2 inline-block text-xs font-semibold text-bolt">
                Open PDF &rarr;
              </span>
            </a>
          ))}
        </div>

        <h2 className="mt-12 text-xs font-bold uppercase tracking-widest text-fg-inv-dim">
          Tools
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-card border border-line bg-ink-2 p-4 transition-colors hover:border-bolt"
            >
              <span className="font-display font-bold text-fg-inv">{t.name}</span>
              <p className="mt-1 text-sm leading-relaxed text-fg-inv-dim">{t.what}</p>
            </Link>
          ))}
        </div>
        <p className="mt-3 text-xs text-fg-inv-dim">
          You are signed in, so these just open. Bookmark the ones you use.
        </p>

        <h2 className="mt-12 text-xs font-bold uppercase tracking-widest text-fg-inv-dim">
          The three rules
        </h2>
        <ol className="mt-4 space-y-3 text-fg-inv-dim">
          <li className="rounded-card border border-line bg-ink-2 p-4">
            <strong className="text-fg-inv">The deductible is theirs.</strong> Never offer to
            waive, cover, absorb, or &ldquo;work with&rdquo; it. It is a crime in Texas.
          </li>
          <li className="rounded-card border border-line bg-ink-2 p-4">
            <strong className="text-fg-inv">You are not an adjuster.</strong> They file.
            You document and meet the adjuster. You never say what the policy covers.
          </li>
          <li className="rounded-card border border-line bg-ink-2 p-4">
            <strong className="text-fg-inv">Texas does not license roofers.</strong> Never say
            &ldquo;licensed.&rdquo; Say insured for {site.liabilityCoverage}, and offer to show
            the certificate.
          </li>
        </ol>

        <p className="mt-10 border-t border-line pt-5 text-xs text-fg-inv-dim">
          Internal only. Not for distribution outside PowerEdge. Questions, call the
          office at{" "}
          <a href={site.phoneHref} className="font-semibold text-bolt">{site.phone}</a>.
        </p>
      </div>
    </div>
  );
}
