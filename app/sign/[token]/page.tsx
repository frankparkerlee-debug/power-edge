import type { Metadata } from "next";
import { Container, Kicker } from "@/components/ui";
import { getByToken, type ScopeLine } from "@/lib/contracts";
import { SignAgreement } from "@/components/SignAgreement";
import { site } from "@/lib/site";

// Homeowner signing page. The token in the URL is the credential, so this is
// never indexed and carries no listing of other agreements.
export const metadata: Metadata = {
  title: "Your agreement",
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const c = await getByToken(token);

  const wrap = "bg-ink py-14 sm:py-20";

  if (!c) {
    return (
      <section className={wrap}>
        <Container className="max-w-xl">
          <h1 className="font-display text-3xl text-fg-inv">We can&apos;t find that agreement.</h1>
          <p className="mt-3 text-fg-inv-dim">
            The link may have expired or been replaced. Call or text{" "}
            <a href={site.phoneHref} className="font-semibold text-bolt">{site.phone}</a>{" "}
            and we&apos;ll send a new one.
          </p>
        </Container>
      </section>
    );
  }

  const status = String(c.status);
  if (status === "signed") {
    return (
      <section className={wrap}>
        <Container className="max-w-xl">
          <h1 className="font-display text-3xl text-fg-inv">This one&apos;s already signed.</h1>
          <p className="mt-3 text-fg-inv-dim">
            Your copy was emailed when you signed it. Need another, or want to
            cancel? Call or text{" "}
            <a href={site.phoneHref} className="font-semibold text-bolt">{site.phone}</a>.
          </p>
        </Container>
      </section>
    );
  }

  const scope = (Array.isArray(c.scope) ? c.scope : []) as ScopeLine[];
  const claimBased = c.claim_based !== false;

  return (
    <section className={wrap}>
      <Container className="max-w-2xl">
        <Kicker className="mb-5">Residential repair agreement</Kicker>
        <h1 className="font-display text-3xl leading-tight text-fg-inv sm:text-4xl">
          Please read this, then sign.
        </h1>
        <p className="mt-4 text-fg-inv-dim">
          Prepared for <strong className="text-fg-inv">{String(c.owner_names)}</strong> at{" "}
          <strong className="text-fg-inv">{String(c.property_address)}</strong>.
        </p>

        <div className="mt-8 rounded-card border border-line bg-ink-2 p-6">
          <h2 className="font-display text-lg font-bold text-fg-inv">The work</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {scope.map((s, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="py-2.5 pr-4 text-fg-inv-dim">{s.description}</td>
                  <td className="py-2.5 text-right font-semibold text-fg-inv">{s.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.total_price ? (
            <p className="mt-3 text-right font-display text-lg font-bold text-bolt">
              Total {String(c.total_price)}
            </p>
          ) : null}
        </div>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-fg-inv-dim">
          <p>
            <strong className="text-fg-inv">No deposit is due at signing.</strong>{" "}
            {claimBased
              ? "This work is going through your insurance claim. Your carrier sets the scope and the price, and you pay your deductible."
              : "Payment is due on substantial completion unless we agree a written schedule."}
          </p>

          <div className="rounded-md border-2 border-line p-4 font-semibold text-fg-inv">
            TEXAS LAW REQUIRES A PERSON INSURED UNDER A PROPERTY INSURANCE POLICY TO PAY ANY
            DEDUCTIBLE APPLICABLE TO A CLAIM MADE UNDER THE POLICY. IT IS A VIOLATION OF TEXAS
            LAW FOR A SELLER OF GOODS OR SERVICES WHO REASONABLY EXPECTS TO BE PAID WHOLLY OR
            PARTLY FROM THE PROCEEDS OF A PROPERTY INSURANCE CLAIM TO KNOWINGLY ALLOW THE
            INSURED PERSON TO FAIL TO PAY, OR ASSIST THE INSURED PERSON&rsquo;S FAILURE TO PAY,
            THE APPLICABLE INSURANCE DEDUCTIBLE.
          </div>

          <p>
            <strong className="text-fg-inv">We are not your adjuster.</strong> Texas Insurance
            Code § 4102.163 bars a contractor from filing or negotiating your claim. You file
            it; we document what we found and meet your adjuster.
          </p>
          <p>
            <strong className="text-fg-inv">Changes are in writing.</strong> Any change to scope
            or price is a written change order signed by both of us before that work happens.
          </p>
          <p>
            <strong className="text-fg-inv">Warranty.</strong> One year on our workmanship from
            substantial completion. Manufacturer warranties on materials pass to you on their
            own terms.
          </p>
          <p>
            <strong className="text-fg-inv">If your claim is denied</strong>, either of us can
            end this in writing and you owe nothing for work not yet done.
          </p>
          <p>
            Texas does not license roofing contractors and we make no claim to a roofing
            license. We carry {site.liabilityCoverage} in liability coverage and will show you
            the certificate on request. Full terms:{" "}
            <a href="/agreement" className="font-semibold text-bolt">poweredgetx.com/agreement</a>.
          </p>

          <div className="rounded-md border-2 border-bolt bg-bolt/10 p-4 font-semibold text-fg-inv">
            YOU, THE BUYER, MAY CANCEL THIS TRANSACTION AT ANY TIME PRIOR TO MIDNIGHT OF THE
            THIRD BUSINESS DAY AFTER THE DATE YOU SIGN. We email you that right, in writing,
            with the deadline date, the moment you sign.
          </div>
        </div>

        <div className="mt-8 rounded-card border border-line bg-ink-2 p-6">
          <SignAgreement
            token={token}
            ownerNames={String(c.owner_names)}
            address={String(c.property_address)}
            email={String(c.owner_email ?? "")}
            scope={scope}
            total={String(c.total_price ?? "")}
            claimBased={claimBased}
          />
        </div>
      </Container>
    </section>
  );
}
