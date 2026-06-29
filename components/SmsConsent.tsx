import Link from "next/link";
import { site } from "@/lib/site";

/**
 * A2P 10DLC / TCPA consent disclosure. Required by CallRail (and the carriers)
 * at every point a phone number is collected or a text CTA is offered.
 * Keep this wording in sync with /sms-terms and /privacy.
 */
export function SmsConsent({ light = true }: { light?: boolean }) {
  const dim = light ? "text-fg-inv-dim" : "text-fg-dim";
  const link = light ? "text-bolt hover:text-bolt-hi" : "text-bolt-deep hover:underline";
  return (
    <p className={`text-center text-[11px] leading-relaxed ${dim}`}>
      By providing your number you agree to receive calls &amp; texts from{" "}
      {site.name} about your request, including by autodialer. Consent isn&apos;t
      a condition of purchase. Msg frequency varies; msg &amp; data rates may
      apply. Reply STOP to opt out, HELP for help. See our{" "}
      <Link href="/sms-terms" className={link}>
        SMS Terms
      </Link>{" "}
      &amp;{" "}
      <Link href="/privacy" className={link}>
        Privacy Policy
      </Link>
      .
    </p>
  );
}
