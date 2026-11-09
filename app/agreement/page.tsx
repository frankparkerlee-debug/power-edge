import type { Metadata } from "next";
import Link from "next/link";
import { Container, Kicker } from "@/components/ui";
import { site } from "@/lib/site";

/**
 * Public inspection agreement.
 *
 * Scope decision: the website books a FREE INSPECTION and nothing else. It
 * never authorizes repair work, never takes payment, and never puts a
 * homeowner on a contract for a roof. So the operative, customer-facing
 * agreement is the inspection agreement, and it can be live today because
 * every term in it is already how we work.
 *
 * The repair and payment contract is a different document with different
 * risk, and it is with counsel. It is deliberately NOT what a homeowner
 * accepts by booking online.
 *
 * Published publicly on purpose. The whole positioning is that a homeowner
 * can verify us, and a contractor whose terms are a secret until the
 * doorstep is the thing we are arguing against.
 */
export const metadata: Metadata = {
  title: "Inspection Agreement & Terms",
  description:
    "The terms that apply when you book a free roof inspection with PowerEdge. Plain language, published before you book, not handed to you on the doorstep.",
  alternates: { canonical: `${site.url}/agreement` },
};

const UPDATED = "November 9, 2026";

function Clause({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line py-7">
      <h2 className="font-display text-lg font-bold text-fg-inv">
        <span className="text-bolt">{n}.</span> {title}
      </h2>
      <div className="mt-2 space-y-3 leading-relaxed text-fg-inv-dim">{children}</div>
    </div>
  );
}

export default function AgreementPage() {
  return (
    <section className="bg-ink py-14 sm:py-20">
      <Container className="max-w-3xl">
        <Kicker className="mb-5">Inspection agreement</Kicker>
        <h1 className="font-display text-4xl leading-[1.02] text-fg-inv sm:text-5xl">
          What you agree to when you book.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-fg-inv-dim">
          All of it, in plain language, published before you book instead of
          handed to you on a clipboard. Booking an inspection does not commit
          you to any work, any payment, or any insurance claim.
        </p>
        <p className="mt-3 text-sm text-fg-inv-dim">Last updated {UPDATED}</p>

        <div className="mt-10">
          <Clause n="1" title="What we do">
            <p>
              We inspect and photograph your roof and the related components at
              no charge, and give you a written assessment of what we found.
              You get that assessment whether or not there is damage worth
              claiming, and whether or not you hire us.
            </p>
          </Clause>

          <Clause n="2" title="What booking does not do">
            <p>
              It does not authorize any repair or replacement. It does not
              create a payment obligation. It does not file an insurance claim.
              Work only ever proceeds under a separate written scope and price
              that you sign, after your carrier has issued its scope of loss
              where a claim is involved.
            </p>
          </Clause>

          <Clause n="3" title="We are not your adjuster">
            <p>
              PowerEdge is a contractor, not a public insurance adjuster. Under
              Texas Insurance Code § 4102.163 we may not file your claim,
              negotiate it for you, or tell you what your policy covers, and we
              will not. You file; we document what we found and meet your
              adjuster on site with our photos and measurements.
            </p>
          </Clause>

          <Clause n="4" title="Your deductible">
            <p>
              Texas law requires a person insured under a property insurance
              policy to pay any deductible applicable to a claim made under the
              policy. It is a violation of Texas law for a seller of goods or
              services who reasonably expects to be paid wholly or partly from
              the proceeds of a property insurance claim to knowingly allow the
              insured person to fail to pay, or assist the insured
              person&apos;s failure to pay, the applicable insurance deductible.
            </p>
            <p>
              We do not waive, rebate or absorb any part of a deductible. Where
              we finance one, it is at 0% interest with no finance charge, and
              you still pay it in full over the term.
            </p>
          </Clause>

          <Clause n="5" title="Cancelling">
            <p>
              Cancel or move your inspection any time, at no cost, from the link
              in your confirmation email or by calling{" "}
              <a href={site.phoneHref} className="font-semibold text-bolt">{site.phone}</a>.
              Where we sign an agreement with you at your home after knocking
              your door, you also have the cancellation right the law gives you
              for a sale made that way, and we give you that notice in writing
              with the agreement.
            </p>
          </Clause>

          <Clause n="6" title="Your information">
            <p>
              We use what you give us to carry out the inspection and to contact
              you about it. We do not sell it. See our{" "}
              <Link href="/privacy" className="font-semibold text-bolt">privacy policy</Link>{" "}
              and <Link href="/terms" className="font-semibold text-bolt">terms</Link>.
            </p>
          </Clause>

          <Clause n="7" title="Insurance and guarantee">
            <p>
              PowerEdge carries {site.liabilityCoverage} in commercial general
              liability coverage and a certificate is available on request.
              Completed work carries a {site.workmanshipGuarantee}. Texas does
              not license roofers, so we do not claim a roofing license.
            </p>
          </Clause>
        </div>

        <div className="mt-10 rounded-card border border-line bg-ink-2 p-6">
          <p className="font-display text-base font-bold text-fg-inv">
            Doing work, not just an inspection
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-inv-dim">
            If you decide to go ahead, the repair work is covered by a separate
            written agreement with its own scope, price and statutory notices.
            You will have it in hand to read before anything is signed, and
            nothing above commits you to it.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/schedule"
            className="rounded-md bg-bolt px-6 py-3.5 font-display font-bold text-ink transition-colors hover:bg-bolt-hi"
          >
            Book a free inspection
          </Link>
          <Link
            href="/contact"
            className="rounded-md border border-line px-6 py-3.5 font-display font-bold text-fg-inv transition-colors hover:border-bolt"
          >
            Ask us about any of this
          </Link>
        </div>
      </Container>
    </section>
  );
}
