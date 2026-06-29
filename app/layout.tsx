import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Schema } from "@/components/Schema";
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
    default: `${site.legalName} | Licensed Roofing & Electrical in DFW`,
    template: `%s | ${site.name}`,
  },
  description:
    `Licensed Texas electrical contractor and roofing company serving Dallas–Fort Worth. Up-front electrical pricing, free roof inspections, storm/insurance claims by the book. TECL #${site.teclLicense}.`,
  openGraph: {
    title: `${site.legalName} | Roofing & Electrical, Verified`,
    description:
      "The licensed Texas crew that does your roof and your wiring — and hands you the license number to check.",
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
      <body className="min-h-screen flex flex-col">
        <Schema />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
