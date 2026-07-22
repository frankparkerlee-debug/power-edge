import type { Metadata } from "next";
import Link from "next/link";
import { Container, Kicker, SectionHeading } from "@/components/ui";
import { LeadForm } from "@/components/LeadForm";
import { FaqSection } from "@/components/service-blocks";
import { Reviews } from "@/components/Reviews";
import { CtaBand } from "@/components/blocks";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Solar Installer Out of Business? DFW Solar Repair & Service",
  description:
    "Your solar installer went bankrupt or disappeared? We're a licensed Texas electrical contractor that services, repairs, and supports any solar system across Dallas–Fort Worth — plus safe panel removal & reinstall for a new roof. Free assessment.",
};

const faqs = [
  {
    q: "My installer went bankrupt — is my system just stuck?",
    a: "No. Your panels and inverter still work; you've just lost the company that serviced them. We're a licensed electrical contractor and we service, troubleshoot, and repair systems that other companies installed — including Freedom Forever, Titan Solar, ADT Solar, SunPower, and others that have closed.",
  },
  {
    q: "Do I have to have used a specific brand?",
    a: "No. We work on all major panel and inverter brands. If it's on your roof, we can diagnose it — monitoring that's gone dark, production that's dropped, an inverter fault, or a system that quit after your installer disappeared.",
  },
  {
    q: "Why can't a regular roofer help me?",
    a: "Solar is electrical work, and Texas law requires it to be performed under a licensed electrical contractor. Most roofing companies legally can't touch your panels. We hold that license and a 40-year Master Electrician — that's exactly why orphaned-system owners call us.",
  },
  {
    q: "I need a new roof but I have panels. Now what?",
    a: "That's our specialty. The panels have to be safely detached before the roof and reset afterward — electrical work most roofers can't legally do. We handle the roof and the detach & reset in-house, under one licensed team, with one warranty. If storm damage is involved, it's usually a covered line item on your insurance claim.",
  },
  {
    q: "What does it cost?",
    a: "The assessment is free. A service diagnostic is a flat fee, and we quote any repair up front before we do anything. For re-roofs with detach & reset, we walk you through the full number — and on a covered storm claim, you typically pay just your deductible.",
  },
];

const steps = [
  {
    h: "Tell us who installed it",
    p: "Your name, number, and the company that installed your system (even if they're gone). Takes under a minute.",
  },
  {
    h: "A licensed electrician assesses it",
    p: "We check your panels, inverter, monitoring, and the roof underneath — and tell you exactly what's going on.",
  },
  {
    h: "You get a straight plan and price",
    p: "Repair, service, or full detach & reset for a re-roof — quoted up front, no pressure, no disappearing act.",
  },
  {
    h: "We become your ongoing support",
    p: "Now that your original installer is gone, we're the licensed team that keeps your system running for years.",
  },
];

const orphanedInstallers = [
  "Freedom Forever",
  "Titan Solar",
  "ADT Solar",
  "SunPower",
  "Sunfinity",
  "Sunpro",
];

export default function OrphanedSolarPage() {
  return (
    <>
      {/* Hero + form */}
      <section className="relative overflow-hidden bg-ink py-14 sm:py-20">
        <div className="absolute inset-0 grid-texture opacity-60" />
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-bolt/15 blur-[120px]" />
        <Container className="relative flex flex-col-reverse gap-10 lg:grid lg:grid-cols-[1fr_0.95fr] lg:items-start lg:gap-12">
          <div className="lg:pt-4">
            <Kicker className="mb-5">Solar service · Licensed electrician · DFW</Kicker>
            <h1 className="font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl">
              Your solar installer is gone.{" "}
              <span className="bolt-underline">We&apos;re still here.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-fg-inv-dim">
              Freedom Forever, Titan Solar, ADT Solar, SunPower — thousands of DFW
              homeowners are stuck with panels and no one to call. We&apos;re a
              licensed Texas electrical contractor that services, repairs, and
              supports any solar system, no matter who installed it.
            </p>

            <ul className="mt-8 space-y-3 text-fg-inv-dim">
              {[
                "We service systems any company installed — including ones that closed",
                "Licensed electrical contractor — the law requires one for solar work",
                "Monitoring dark? Production down? Inverter fault? We diagnose it",
                "Need a new roof? We detach & reset your panels in-house",
              ].map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bolt">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-ink">
                      <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
                    </svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            <p className="mt-8 text-sm text-fg-inv-dim">
              Licensed &amp; insured Texas electrical contractor · 40-year Master
              Electrician · {site.googleRating}★ ({site.googleReviewCount} reviews)
            </p>
          </div>

          {/* Capture card */}
          <div id="quote" className="scroll-mt-24">
            <div className="rounded-card border border-line bg-ink-2 p-6 shadow-2xl sm:p-7">
              <h2 className="font-display text-2xl font-bold text-fg-inv">
                Get a free system assessment
              </h2>
              <p className="mt-1.5 text-sm text-fg-inv-dim">
                A licensed electrician calls you back fast — tell us what your
                system is doing (or who installed it).
              </p>
              <div className="mt-5">
                <LeadForm compact defaultService="Orphaned solar service" />
              </div>
            </div>

            <Link
              href="/roof-claim-check"
              className="mt-4 flex items-center justify-between rounded-card border border-line bg-ink-2 p-5 transition-colors hover:border-bolt"
            >
              <div>
                <div className="font-display text-base font-bold text-fg-inv">
                  Storm hit your roof too?
                </div>
                <div className="mt-0.5 text-sm text-fg-inv-dim">
                  Check your address for hail — panels come off and back on, on us.
                </div>
              </div>
              <span className="font-display font-bold text-bolt">→</span>
            </Link>
          </div>
        </Container>
      </section>

      {/* Orphaned-installer callout */}
      <section className="bg-paper py-16 sm:py-20">
        <Container>
          <SectionHeading
            kicker="Did one of these install your system?"
            title="If your installer closed, you're not out of luck."
          />
          <p className="mt-4 max-w-2xl text-fg-dim">
            When a solar company goes under, its workmanship warranty and service
            line go with it — but your system doesn&apos;t have to. If any of
            these installed your panels, we can pick up the service:
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {orphanedInstallers.map((n) => (
              <span
                key={n}
                className="rounded-full border border-paper-2 bg-white px-4 py-2 text-sm font-semibold text-fg shadow-sm"
              >
                {n}
              </span>
            ))}
            <span className="rounded-full border border-paper-2 bg-white px-4 py-2 text-sm text-fg-dim shadow-sm">
              …and any other installer
            </span>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="bg-ink py-20 sm:py-28">
        <Container>
          <SectionHeading
            dark
            kicker="How it works"
            title="From orphaned to handled."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {steps.map((s, i) => (
              <div
                key={s.h}
                className="flex gap-4 rounded-card border border-line bg-ink-2 p-6"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bolt font-display text-sm font-extrabold text-ink">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-fg-inv">
                    {s.h}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-fg-inv-dim">
                    {s.p}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <Reviews />

      <FaqSection faqs={faqs} title="Orphaned solar, questions answered." />

      <CtaBand
        heading="Your installer left. We won't."
        sub="A licensed electrician, an honest assessment, and a team that keeps your solar running for years. Tell us where to come."
      />
    </>
  );
}
