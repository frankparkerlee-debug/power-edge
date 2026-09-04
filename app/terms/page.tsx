import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `Terms and conditions for Power Edge, LLC, including website use and text-messaging (SMS) program terms.`,
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
              the services of Power Edge, LLC (&ldquo;{site.name},&rdquo;
              &ldquo;we,&rdquo; &ldquo;us&rdquo;). By using this site or
              contacting us, you agree to these terms.
            </p>
          </div>

          <div>
            <h2>Use of this website</h2>
            <p>
              Content on this site is provided for general information about our
              roofing, home repair, and solar services. Pricing shown is a
              starting estimate and is not a binding quote; final pricing is
              provided in writing after an inspection or on-site assessment.
              Tools such as our roof coverage check and storm/hail check are
              informational only and are not a substitute for a professional
              inspection or insurance advice.
            </p>
          </div>

          <div>
            <h2 id="sms">Text messaging (SMS) program</h2>
            <p>
              Power Edge, LLC sends text message updates and responses to
              electronics customers about pricing and products offered at{" "}
              {site.domain}.
            </p>
            <p>
              When you opt-in to the service, we may send you a message to
              confirm your signup. Message and data rates may apply. Message
              frequency varies. Text &ldquo;HELP&rdquo; for help. Text
              &ldquo;STOP&rdquo; to cancel.
            </p>
            <p>
              You can cancel this service at any time. Just text
              &ldquo;STOP&rdquo; to {site.textNumber}. After you send the message
              &ldquo;STOP&rdquo; to us, we will reply to confirm that you have
              been unsubscribed. After this, you will no longer receive messages
              from us. If you want to join again, just sign up as you did the
              first time, and we will start sending you messages again.
            </p>
            <p>
              If at any time you forget what keywords are supported, just text
              &ldquo;HELP&rdquo; to {site.textNumber}. After you send the message
              &ldquo;HELP&rdquo; to us, we will respond with instructions on how
              to use our service and how to unsubscribe.
            </p>
            <p>
              Participating carriers: AT&amp;T, Verizon Wireless, Sprint,
              T-Mobile, U.S. Cellular, Boost Mobile, MetroPCS, Virgin Mobile,
              Alaska Communications Systems (ACS), Appalachian Wireless (EKN),
              Bluegrass Cellular, Cellular One of East Central, IL (ECIT),
              Cellular One of Northeast Pennsylvania, Cricket, Coral Wireless
              (Mobi PCS), COX, Cross, Element Mobile (Flat Wireless), Epic Touch
              (Elkhart Telephone), GCI, Golden State, Hawkeye (Chat Mobility),
              Hawkeye (NW Missouri), Illinois Valley Cellular, Inland Cellular,
              iWireless (Iowa Wireless), Keystone Wireless (Immix Wireless/PC
              Man), Mosaic (Consolidated or CTC Telecom), Nex-Tech Wireless,
              NTelos, Panhandle Communications, Pioneer, Plateau (Texas RSA 3
              Ltd), Revol, RINA, Simmetry (TMP Corporation), Thumb Cellular,
              Union Wireless, United Wireless, Viaero Wireless, and West Central
              (WCC or 5 Star Wireless).
            </p>
            <p>Carriers are not liable for delayed or undelivered messages.</p>
            <p>
              If you have any questions regarding privacy, please read our{" "}
              <a href="/privacy" className="text-bolt-deep hover:underline">
                Privacy Policy
              </a>
              .
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
              Power Edge, LLC ·{" "}
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
