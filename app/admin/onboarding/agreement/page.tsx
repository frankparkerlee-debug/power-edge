import type { Metadata } from "next";
import Link from "next/link";
import { currentUser, listMembers } from "@/lib/auth";
import { loadSignedAgreement } from "@/lib/onboarding";
import { AGREEMENT_VERSION } from "@/lib/repAgreement";

/**
 * A contractor agreement exactly as it was signed: the text, the typed name,
 * the drawn signature, when, and (for the office) from which IP. A rep sees
 * their own; an admin can open anyone's with ?member=.
 */
export const metadata: Metadata = { title: "Signed agreement", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SignedAgreementPage({ searchParams }: { searchParams: Promise<{ member?: string }> }) {
  const { member } = await searchParams;
  const user = await currentUser();
  if (!user) {
    return (
      <div className="px-5 py-10">
        <p className="text-sm text-gray-600">
          <Link href="/login" className="font-semibold text-[#0c7a40] underline">Sign in</Link> to see your agreement.
        </p>
      </div>
    );
  }
  const isAdmin = user.role === "admin";
  const id = isAdmin && member ? Number(member) : user.id;
  const who = isAdmin && member ? (await listMembers()).find((m) => m.id === id)?.name ?? "This person" : user.name;
  const a = await loadSignedAgreement(id);
  const back = isAdmin && member ? `/admin/onboarding?member=${id}` : "/admin/onboarding";

  if (!a?.agreement_signed_at || !a.agreement_text) {
    return (
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-2xl">
          <Link href={back} className="text-sm font-semibold text-gray-500 hover:text-[#0b0e13]">Back</Link>
          <p className="mt-3 text-sm text-gray-600">{isAdmin && member ? `${who} hasn't signed the agreement yet.` : "You haven't signed the agreement yet."}</p>
        </div>
      </div>
    );
  }

  const blocks = a.agreement_text.split(/\n\n+/);
  const when = new Date(a.agreement_signed_at).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const current = a.agreement_version === AGREEMENT_VERSION;

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl">
        <Link href={back} className="text-sm font-semibold text-gray-500 hover:text-[#0b0e13]">Back</Link>
        <div className="mt-2 rounded-lg border border-[#e3e6ea] bg-white p-5 text-sm leading-relaxed text-[#3b424e] sm:p-7">
          {blocks.map((b, i) =>
            i === 0 ? (
              <h1 key={i} className="font-display text-xl font-extrabold text-[#0b0e13]">{b}</h1>
            ) : /^(\d+\.\s|Compensation Schedule$)/.test(b) ? (
              <h2 key={i} className="mt-5 font-semibold text-[#0b0e13]">{b}</h2>
            ) : (
              <p key={i} className="mt-1.5">{b}</p>
            ),
          )}
          <div className="mt-8 border-t border-[#eceef1] pt-5">
            {a.agreement_signature_png ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.agreement_signature_png} alt={`Signature of ${a.agreement_typed_name ?? who}`} className="h-20 w-auto" />
            ) : null}
            <p className="mt-2 text-[#0b0e13]">
              <strong>{a.agreement_typed_name}</strong>
            </p>
            <p className="text-xs text-gray-500">
              Signed electronically {when} Central · version {a.agreement_version}
              {isAdmin && a.agreement_ip ? ` · from ${a.agreement_ip}` : ""}
            </p>
            {!current ? (
              <p className="mt-2 text-xs font-semibold text-[#7a4b00]">An earlier version. The current one is {AGREEMENT_VERSION}.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
