"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { TextFab } from "./TextFab";
import { MobileCtaBar } from "./MobileCtaBar";
import { CallRailFormCapture } from "./CallRailFormCapture";

/**
 * Renders the marketing chrome (header, footer, CTAs) on public pages, but NOT
 * on internal tools like /admin — so the business phone number in the nav/footer
 * doesn't clutter the leads dashboard (and get mistaken for lead data).
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname?.startsWith("/admin");

  if (bare) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <CallRailFormCapture />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <TextFab />
      <MobileCtaBar />
    </>
  );
}
