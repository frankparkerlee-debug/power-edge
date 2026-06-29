import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${site.legalName} collects, uses, and protects your information, including mobile/SMS opt-in data.`,
};

export default function PrivacyPage() {
  return (
    <section className="bg-paper py-16 sm:py-20">
      <Container className="max-w-3xl">
        <h1 className="font-display text-4xl font-extrabold text-fg sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-fg-dim">Last updated: June 29, 2026</p>

        <div className="mt-10 space-y-8 text-fg-dim [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-fg [&_p]:mt-3 [&_p]:leading-relaxed [&_li]:mt-1">
          <div>
            <p>
              {site.legalName} (&ldquo;we,&rdquo; &ldquo;us&rdquo;) respects your
              privacy. This policy explains what information we collect through{" "}
              {site.domain}, how we use it, and your choices.
            </p>
          </div>

          <div>
            <h2>Information we collect</h2>
            <p>
              We collect the information you give us through our forms, phone
              calls, and text messages — typically your name, phone number,
              email address, property address, and details about the service you
              need. We may also collect basic analytics about how the site is
              used.
            </p>
          </div>

          <div>
            <h2>How we use it</h2>
            <p>
              We use your information to respond to your request, schedule and
              perform work, send estimates and updates, handle insurance-claim
              documentation, improve our service, and contact you about your
              project by phone, email, or text.
            </p>
          </div>

          <div>
            <h2>Mobile &amp; text messaging (SMS)</h2>
            <p>
              Power Edge, LLC sends text message updates and responses to
              electronics customers about pricing and products offered at{" "}
              {site.domain}.
            </p>
            <p>
              <strong className="text-fg">
                Mobile information will not be shared with third parties or
                affiliates for marketing or promotional purposes.
              </strong>
            </p>
            <p>
              Power Edge, LLC. We respect your privacy. We use information you
              provide to send and respond to your mobile messages. This includes
              sharing it with platform providers, phone companies, and other
              vendors who help us deliver messages. We won&apos;t share mobile
              information with third parties for marketing. Text messaging
              originator opt-in data and consent are exempt from this. We may
              disclose information to satisfy legal, regulatory, or governmental
              requests, avoid liability, or protect our rights or property. This
              policy applies to your use of the Text Message Service and
              doesn&apos;t modify our general Privacy Policy, which may govern
              our relationship with you in other contexts.
            </p>
            <p>
              See our{" "}
              <a href="/terms" className="text-bolt-deep hover:underline">
                Terms &amp; Conditions
              </a>{" "}
              for the full messaging program, including how to opt out (reply
              STOP) and get help (reply HELP).
            </p>
          </div>

          <div>
            <h2>How we share information</h2>
            <p>
              We do not sell your personal information. We share it only with
              service providers who help us operate (for example, scheduling and
              communication tools) under confidentiality obligations, or when
              required by law.
            </p>
          </div>

          <div>
            <h2>Your choices</h2>
            <p>
              You can opt out of text messages anytime by replying STOP, and you
              can ask us to update or delete your information by contacting us.
            </p>
          </div>

          <div>
            <h2>Contact us</h2>
            <p>
              {site.legalName} ·{" "}
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
