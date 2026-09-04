import type { Metadata } from "next";
import { Container, Kicker, Stars } from "@/components/ui";
import { LeadForm } from "@/components/LeadForm";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact — Free Inspection & Quotes",
  description:
    "Call PowerEdge at " +
    site.phone +
    " or book a free storm roof inspection online. Serving Dallas–Fort Worth.",
};

export default function ContactPage() {
  return (
    <section className="relative overflow-hidden bg-ink py-16 sm:py-20">
      <div className="absolute inset-0 grid-texture opacity-60" />
      <Container className="relative grid gap-12 lg:grid-cols-2 lg:items-start">
        <div>
          <Kicker className="mb-5">Get in touch</Kicker>
          <h1 className="font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl">
            Free inspections. Fast callbacks.
          </h1>
          <p className="mt-6 max-w-md text-lg text-fg-inv-dim">
            Tell us what&apos;s going on and a real person from our team will
            call you back — usually within the hour during business hours.
          </p>

          <div className="mt-10 space-y-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
                Call us
              </div>
              <a
                href={site.phoneHref}
                className="font-display text-3xl font-extrabold text-bolt hover:text-bolt-hi"
              >
                {site.phone}
              </a>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
                Text us
              </div>
              <a
                href={site.textHref}
                className="font-display text-3xl font-extrabold text-bolt hover:text-bolt-hi"
              >
                {site.textNumber}
              </a>
              <div className="text-xs text-fg-inv-dim">
                Msg &amp; data rates may apply. Reply STOP to opt out. See our{" "}
                <a href="/terms" className="text-bolt hover:underline">
                  Terms
                </a>
                .
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
                Email
              </div>
              <a
                href={`mailto:${site.email}`}
                className="font-display text-lg font-bold text-fg-inv hover:text-bolt"
              >
                {site.email}
              </a>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-fg-inv-dim">
                Service area
              </div>
              <p className="text-fg-inv">{site.serviceArea}</p>
            </div>
            <div className="flex items-center gap-3 rounded-card border border-line bg-ink-2 p-4">
              <Stars />
              <span className="text-sm text-fg-inv-dim">
                <strong className="text-fg-inv">{site.googleRating}</strong> from{" "}
                {site.googleReviewCount} Google reviews
              </span>
            </div>
            <p className="text-sm text-fg-inv-dim">
              Licensed & insured ·{" "}
              {site.liabilityCoverage} liability coverage
            </p>
          </div>
        </div>

        <div className="rounded-card border border-line bg-ink-2 p-7 shadow-2xl">
          <h2 className="font-display text-2xl font-bold text-fg-inv">
            Request a free quote
          </h2>
          <p className="mt-1.5 text-sm text-fg-inv-dim">
            Roofing, home repair, or storm claim — we&apos;ll point you to
            the right crew.
          </p>
          <div className="mt-6">
            <LeadForm />
          </div>
        </div>
      </Container>
    </section>
  );
}
