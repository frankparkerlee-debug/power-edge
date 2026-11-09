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

  if (portal) {
    return <PortalShell>{children}</PortalShell>;
  }

  return (
    <>
      <Analytics />
      <CallRailFormCapture />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <TextFab />
      <MobileCtaBar />
    </>
  );
}
