import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `Terms and conditions for ${site.legalEntity}, including website use and text-messaging (SMS) program terms.`,
};

export default function TermsPage() {
  return (
    <section className="bg-paper py-16 sm:py-20">
      <Container className="max-w-3xl">
        <h1 className="font-display text-4xl font-extrabold text-fg sm:text-5xl">
          Terms &amp; Conditions
        </h1>
        <p className="mt-3 text-sm text-fg-dim">Last updated: June 29, 2026</p>

        <div className="mt-10 space-y-8 text-fg-dim [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-fg [&_h2]:scroll-mt-24 [&_p]:mt-3 [&_p]:leading-relaxed">
          <div>
            <p>
              These Terms &amp; Conditions govern your use of {site.domain} and
              the services of {site.legalEntity} (&ldquo;{site.name},&rdquo;
              &ldquo;we,&rdquo; &ldquo;us&rdquo;). By using this site or
              contacting us, you agree to these terms.
            </p>
          </div>

          <div>
            <h2>Use of this website</h2>
            <p>
              Content on this site is provided for general information about our
              roofing, electrical, and solar services. Pricing shown is a
              starting estimate and is not a binding quote; final pricing is
              provided in writing after an inspection or on-site assessment. Tools
              such as our roof coverage check and storm/hail check are
              informational only and are not a substitute for a professional
              inspection or insurance advice.
            </p>
          </div>

          <div>
            <h2 id="sms">Text messaging (SMS) program</h2>
            <p>
              By submitting your information, you agree to receive transactional /
              informational text messages from {site.legalEntity} related to your
              inquiry, scheduling, estimates, appointment reminders, project
              updates, and customer service. Consent to receive texts is not a
              condition of any purchase.
            </p>
            <p>
              <strong className="text-fg">How to opt in:</strong> provide your
              mobile number through a form on this site, text us first at{" "}
              {site.textNumber}, or give your number to our team and agree to be
              contacted by text.
            </p>
            <p>
              <strong className="text-fg">Message frequency</strong> may vary
              based on your interaction with us.{" "}
              <strong className="text-fg">Message and data rates may apply</strong>{" "}
              depending on your mobile carrier&apos;s plan.
            </p>
            <p>
              <strong className="text-fg">Opt out:</strong> reply{" "}
              <strong className="text-fg">STOP</strong> to any message to cancel.
              For help, reply <strong className="text-fg">HELP</strong> or contact
              us at{" "}
              <a href={site.phoneHref} className="text-bolt-deep hover:underline">
                {site.phone}
              </a>
              . Carriers are not liable for delayed or undelivered messages.
            </p>
            <p>
              No mobile information will be shared with third parties or
              affiliates for marketing or promotional purposes. Text-message
              opt-in data and consent are never shared with any third parties for
              their own marketing. See our{" "}
              <a href="/privacy" className="text-bolt-deep hover:underline">
                Privacy Policy
              </a>{" "}
              for full details.
            </p>
          </div>

          <div>
            <h2>Workmanship &amp; warranties</h2>
            <p>
              Our installation work is backed by a {site.workmanshipGuarantee},
              separate from any manufacturer material warranty. Warranty details
              are provided with your written scope of work.
            </p>
          </div>

          <div>
            <h2>Contact</h2>
            <p>
              {site.legalEntity} ·{" "}
              <a href={site.phoneHref} className="text-bolt-deep hover:underline">
                {site.phone}
              </a>{" "}
              ·{" "}
              <a
                href={`mailto:${site.email}`}
                className="text-bolt-deep hover:underline"
              >
                {site.email}
              </a>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
