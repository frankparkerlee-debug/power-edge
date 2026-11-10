"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { TextFab } from "./TextFab";
import { MobileCtaBar } from "./MobileCtaBar";
import { CallRailFormCapture } from "./CallRailFormCapture";
import { Analytics } from "./Analytics";
import { PortalShell } from "./PortalShell";

/**
 * Three chromes, not two.
 *
 * Public pages get the marketing chrome. Internal pages used to get NOTHING,
 * which is why the portal had no navigation, no back and no sense of place,
 * and why /sales (missing from the old exclusion list) shipped with a
 * customer "Free Inspection" bar pinned over an admin tool. Internal pages now
 * get the portal shell.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const portal = pathname.startsWith("/admin") || pathname.startsWith("/sales");
  // Sign-in is a team page. It gets neither marketing CTAs nor portal nav,
  // because there is nothing to navigate to until you are signed in.
  const bare = pathname.startsWith("/login") || pathname.startsWith("/auth");
  if (bare) return <main className="flex-1">{children}</main>;

  if (portal) {
    return <PortalShell>{children}</PortalShell>;
  }

  /*
   * A homeowner signing a contract, or looking at their own booking, is a
   * customer, not a prospect. The marketing bar pinned a "Free Inspection"
   * button under someone halfway through signing a twenty-thousand-dollar
   * agreement for an inspection they had already had. Those pages keep the
   * header and footer, which carry the trust signals, and the page itself
   * already says how to call or text with a question.
   */
  const customerDoc = pathname.startsWith("/sign") || pathname.startsWith("/appointment");

  return (
    <>
      <Analytics />
      <CallRailFormCapture />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      {!customerDoc && <TextFab />}
      {!customerDoc && <MobileCtaBar />}
    </>
  );
}
