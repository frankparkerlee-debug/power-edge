import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "SMS Terms & Conditions",
  description: `Text messaging terms for ${site.legalName}, including consent, message frequency, opt-out, and rates.`,
};

export default function SmsTermsPage() {
  return (
    <section className="bg-paper py-16 sm:py-20">
      <Container className="max-w-3xl">
        <h1 className="font-display text-4xl font-extrabold text-fg sm:text-5xl">
          SMS Terms &amp; Conditions
        </h1>
        <p className="mt-3 text-sm text-fg-dim">
          Last updated: June 29, 2026
        </p>

        <div className="mt-10 space-y-8 text-fg-dim [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-fg [&_p]:mt-3 [&_p]:leading-relaxed">
          <div>
            <h2>1. Program description</h2>
            <p>
              When you opt in to the {site.name} text messaging program, you
              will receive text messages related to your inquiry, scheduling,
              estimates, appointment reminders, project updates, and customer
              service from {site.legalName}.
            </p>
          </div>

          <div>
            <h2>2. How you opt in</h2>
            <p>
              You consent to receive text messages when you provide your mobile
              number through a form on this website, by texting us first at{" "}
              {site.textNumber}, or by giving your number to our team and
              agreeing to be contacted by text. Consent to receive marketing or
              promotional texts is not a condition of purchasing any goods or
              services.
            </p>
          </div>

          <div>
            <h2>3. Message frequency</h2>
            <p>
              Message frequency varies based on your interaction with us (for
              example, scheduling and project updates). You may receive
              recurring messages related to an active request or job.
            </p>
          </div>

          <div>
            <h2>4. Cost</h2>
            <p>
              Message and data rates may apply, depending on your mobile
              carrier&apos;s plan. {site.name} does not charge for the messages,
              but your carrier may.
            </p>
          </div>

          <div>
            <h2>5. Opt out</h2>
            <p>
              You can cancel the SMS service at any time by replying{" "}
              <strong className="text-fg">STOP</strong> to any message. After you
              send STOP, we will send a confirmation message and then stop
              sending texts. You may receive additional messages while your
              request is being processed.
            </p>
          </div>

          <div>
            <h2>6. Help</h2>
            <p>
              If you are experiencing issues, reply{" "}
              <strong className="text-fg">HELP</strong> to any message for
              assistance, or contact us at{" "}
              <a href={site.phoneHref} className="text-bolt-deep hover:underline">
                {site.phone}
              </a>{" "}
              or{" "}
              <a
                href={`mailto:${site.email}`}
                className="text-bolt-deep hover:underline"
              >
                {site.email}
              </a>
              .
            </p>
          </div>

          <div>
            <h2>7. Carriers</h2>
            <p>
              Carriers are not liable for delayed or undelivered messages. Text
              delivery is subject to effective transmission from your wireless
              service provider and is not guaranteed.
            </p>
          </div>

          <div>
            <h2>8. Privacy</h2>
            <p>
              No mobile information will be shared with third parties or
              affiliates for marketing or promotional purposes. Information
              sharing to subcontractors in support services, such as customer
              service, is permitted. All other use is described in our{" "}
              <a href="/privacy" className="text-bolt-deep hover:underline">
                Privacy Policy
              </a>
              . Text-message opt-in data and consent are never shared with any
              third party for their own marketing.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
