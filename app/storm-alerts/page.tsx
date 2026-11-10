import type { Metadata } from "next";
import { Container, Kicker } from "@/components/ui";
import StormAlertSignup from "@/components/StormAlertSignup";

// Homeowner-facing. Filled in on a setter's phone at the door or from a QR
// code. Not linked from the site yet, so it stays out of search for now.
export const metadata: Metadata = {
  title: "Storm alerts for your street",
  description: "Get a text when a hail or tornado warning covers your address. Free, and you can stop anytime.",
  robots: { index: false, follow: false },
};

export default async function StormAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; lat?: string; lon?: string; t?: string }>;
}) {
  const { a, lat, lon, t } = await searchParams;
  return (
    <section className="bg-ink py-12 sm:py-16">
      <Container className="max-w-xl">
        <Kicker className="mb-4">Storm alerts</Kicker>
        <h1 className="font-display text-3xl leading-[1.05] text-fg-inv sm:text-4xl">
          Know before the hail hits your street.
        </h1>
        <p className="mt-4 leading-relaxed text-fg-inv-dim">
          When the National Weather Service warns for hail or a tornado over your address, we text you
          that night. If you want, we check your roof free the next day. No other texts.
        </p>
        <div className="mt-8">
          <StormAlertSignup
            initialAddress={a ?? ""}
            lat={lat ?? ""}
            lon={lon ?? ""}
            targetId={t ?? ""}
          />
        </div>
      </Container>
    </section>
  );
}
