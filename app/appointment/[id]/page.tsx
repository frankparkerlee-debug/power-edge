import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { getAppointment } from "@/lib/scheduling";
import { CancelBooking } from "@/components/CancelBooking";
import { site } from "@/lib/site";

// Manage-your-booking page. The id is a v4 UUID, which is the only thing
// guarding it: enough for "cancel my own inspection", and it carries no
// information worth harvesting. Never indexed.
export const metadata: Metadata = {
  title: "Your inspection",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function when(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "long", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

export default async function AppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appt = await getAppointment(id);

  return (
    <section className="bg-ink py-16 sm:py-24">
      <Container className="max-w-lg">
        {!appt ? (
          <>
            <h1 className="font-display text-3xl text-fg-inv">We can&apos;t find that inspection.</h1>
            <p className="mt-3 text-fg-inv-dim">
              The link may be out of date. Call or text{" "}
              <a href={site.phoneHref} className="font-semibold text-bolt">{site.phone}</a>{" "}
              and we&apos;ll sort it out.
            </p>
          </>
        ) : appt.status !== "booked" ? (
          <>
            <h1 className="font-display text-3xl text-fg-inv">That inspection is cancelled.</h1>
            <p className="mt-3 text-fg-inv-dim">
              Nothing further is scheduled. Want a new time?{" "}
              <a href="/schedule" className="font-semibold text-bolt">Pick one here</a>.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl leading-tight text-fg-inv">
              Your free roof inspection
            </h1>
            <div className="mt-6 rounded-card border border-line bg-ink-2 p-6">
              <p className="font-display text-xl font-bold text-bolt">{when(appt.slot_start)}</p>
              {appt.address && <p className="mt-1 text-fg-inv-dim">{appt.address}</p>}
              <p className="mt-4 text-sm leading-relaxed text-fg-inv-dim">
                That&apos;s a two-hour arrival window, so we&apos;ll call before we head
                over. You don&apos;t need to be home for the roof itself, but it helps
                to be there for the walkthrough.
              </p>
            </div>
            <CancelBooking id={appt.id} />
            <p className="mt-6 text-sm text-fg-inv-dim">
              Need a different day instead? Cancel here, then{" "}
              <a href="/schedule" className="font-semibold text-bolt">pick a new window</a>.
              Or just call{" "}
              <a href={site.phoneHref} className="font-semibold text-bolt">{site.phone}</a>.
            </p>
          </>
        )}
      </Container>
    </section>
  );
}
