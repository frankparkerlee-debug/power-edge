import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { Schema } from "@/components/Schema";
import { SiteChrome } from "@/components/SiteChrome";
import { site } from "@/lib/site";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.legalName} | DFW Roofing Company — Storm & Hail Restoration`,
    template: `%s | ${site.name}`,
  },
  description:
    `Insurance-first storm & hail roof restoration across Dallas–Fort Worth. Free inspections, deductible financing, and one licensed, insured team you can actually verify.`,
  openGraph: {
    title: `${site.legalName} | Storm Roof Restoration, Verified`,
    description:
      "The insurance-first DFW roof team you can actually verify — free inspections, deductible financing, licensed and insured.",
    url: site.url,
    siteName: site.name,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col pb-14 lg:pb-0">
        <Schema />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
