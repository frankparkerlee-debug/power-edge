import type { Metadata } from "next";
import { Container, Kicker } from "@/components/ui";
import { BookInspection } from "@/components/BookInspection";
import { availableSlots } from "@/lib/scheduling";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Book Your Free Roof Inspection: Pick Your Time",
  description:
    "Pick a two-hour arrival window for a free, documented roof inspection anywhere in Dallas–Fort Worth. Photos, measurements, and an honest verdict in writing, claim or no claim.",
  alternates: { canonical: `${site.url}/schedule` },
};

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const days = await availableSlots();
  return (
    <section className="relative overflow-hidden bg-ink py-14 sm:py-20">
      <div className="absolute inset-0 grid-texture opacity-40" />
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-bolt/15 blur-[120px]" />
      <Container className="relative grid gap-12 lg:grid-cols-[0.95fr_1fr] lg:items-start">
        <div className="lg:pt-4">
          <Kicker className="mb-5">Free inspection · Dallas–Fort Worth</Kicker>
          <h1 className="font-display text-4xl leading-[0.98] text-fg-inv sm:text-5xl">
            Pick your window.{" "}
            <span className="bolt-underline">We&apos;ll be there.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-fg-inv-dim">
            No phone tag, no &ldquo;someone will call you back.&rdquo; Choose a two-hour
            arrival window and it&apos;s on our board the second you hit book.
          </p>

          <ul className="mt-8 space-y-3 text-fg-inv-dim">
            {[
              "Photos, measurements, and a written assessment, free",
              "An honest verdict, including “your roof is fine”",
              "Documented properly if it is worth filing a claim",
              "No high-pressure pitch at your door",
            ].map((b) => (
              <li key={b} className="flex gap-3">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bolt">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-ink">
                    <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2l11-11-1.4-1.4z" />
                  </svg>
                </span>
                {b}
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm text-fg-inv-dim">
            Rather talk to a person? Call or text{" "}
            <a href={site.phoneHref} className="font-semibold text-bolt">{site.phone}</a>.
          </p>
        </div>

        <div className="rounded-card border border-line bg-ink-2 p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold text-fg-inv">
            Book your free roof inspection
          </h2>
          <p className="mt-1 mb-5 text-sm text-fg-inv-dim">
            Takes about 30 seconds.
          </p>
          <BookInspection source="schedule-page" initialDays={days} />
        </div>
      </Container>
    </section>
  );
}
