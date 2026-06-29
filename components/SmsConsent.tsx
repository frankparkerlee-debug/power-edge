import Link from "next/link";
import { site } from "@/lib/site";

/**
 * A2P 10DLC / TCPA consent disclosure. The first sentence is the exact,
 * client-approved opt-in language and must stay verbatim — CallRail / carrier
 * vetting checks for it. Keep it in sync with /terms and /privacy.
 */
export function SmsConsent({ light = true }: { light?: boolean }) {
  const dim = light ? "text-fg-inv-dim" : "text-fg-dim";
  const link = light ? "text-bolt hover:text-bolt-hi" : "text-bolt-deep hover:underline";
  return (
    <p className={`text-center text-[11px] leading-relaxed ${dim}`}>
      By submitting your information, I am agreeing to receive transactional /
      informational text messages from {site.legalEntity}. Message Frequency may
      vary. Msg and data rates may apply. Reply STOP to opt out. See our{" "}
      <Link href="/privacy" className={link}>
        Privacy Policy
      </Link>{" "}
      &amp;{" "}
      <Link href="/terms" className={link}>
        Terms
      </Link>
      .
    </p>
  );
}
