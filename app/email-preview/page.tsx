import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import {
  captureEmails,
  leadSequence,
  sendAgreementToSign,
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  sendClaimComplete,
  sendClaimNurture,
  sendInspectionAssessment,
  sendSignedAgreement,
  type LeadEmailCtx,
} from "@/lib/emails";

/**
 * Every email a homeowner can receive, rendered exactly as it sends.
 *
 * This page used to show only the lead nurture sequence. The emails a
 * homeowner gets once they are actually a customer, the booking, the
 * inspection assessment, the agreement and the signed copy, had no preview at
 * all, so their design was only ever seen by whoever happened to receive one.
 *
 * Each one runs through the real send function inside captureEmails(), which
 * hands back the message instead of sending it. Sample data only.
 *
 * Internal: open in development, admins only in production.
 */
export const metadata: Metadata = {
  title: "Customer emails",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const KEY = "preview";
const HOME = "homeowner@example.com";
const ADDR = "4412 Oak Lawn Ave, Dallas, TX 75219";

const lead: LeadEmailCtx = {
  firstName: "Chris",
  service: "Roof claim check (LIKELY QUALIFIES)",
  solar: false,
  financing: true,
};

type Shown = { group: string; label: string; subject: string; html: string };

async function render(): Promise<Shown[]> {
  const out: Shown[] = [];
  const take = async (group: string, label: string, run: () => Promise<unknown>) => {
    const sent = await captureEmails(run);
    // The booking also notifies the office; only show what the homeowner gets.
    for (const m of sent.filter((x) => x.to === HOME)) {
      out.push({ group, label, subject: m.subject, html: m.html });
    }
  };

  await take("Booking", "Inspection confirmed", () =>
    sendAppointmentConfirmation(KEY, {
      name: "Chris Whitfield",
      phone: "2145559876",
      email: HOME,
      address: ADDR,
      dayLabel: "Thu, Nov 12",
      timeLabel: "10:00 AM – 12:00 PM",
      id: "00000000-0000-0000-0000-000000000000",
      closer: "Zach Delgado",
      setter: "Test Setter",
    }),
  );
  await take("Booking", "Inspection reminder (day of)", () =>
    sendAppointmentReminder(KEY, {
      id: "00000000-0000-0000-0000-000000000000",
      name: "Chris Whitfield",
      email: HOME,
      address: ADDR,
      when: "Thursday 10:00 AM",
    }),
  );
  await take("Inspection", "Assessment: storm damage found", () =>
    sendInspectionAssessment(KEY, {
      name: "Chris Whitfield",
      email: HOME,
      address: ADDR,
      inspectedOn: "November 12, 2026",
      closer: "Zach Delgado",
      verdict: "qualifies",
      findings:
        "Hail bruising on the south and west slopes, 9 hits per test square, and two dented ridge vents.",
    }),
  );
  await take("Inspection", "Assessment: roof is fine", () =>
    sendInspectionAssessment(KEY, {
      name: "Chris Whitfield",
      email: HOME,
      address: ADDR,
      inspectedOn: "November 12, 2026",
      closer: "Zach Delgado",
      verdict: "fine",
      findings: "Shingles intact with normal wear for their age. No bruising or granule loss.",
    }),
  );
  await take("Agreement", "Agreement to sign: insurance claim", () =>
    sendAgreementToSign(KEY, {
      ownerNames: "Chris Whitfield",
      address: ADDR,
      email: HOME,
      url: "https://poweredgetx.com/sign/preview",
      rep: "Zach Delgado",
      total: "20000",
      claimBased: true,
      carrier: "Allstate",
      claimNumber: "0784412-TX",
      deductible: "5000",
      scope: [
        { description: "Tear off and replace roof, 32 squares at $550.00 per square", price: "17600" },
        { description: "Seamless gutters, front and back", price: "2400" },
      ],
    }),
  );
  await take("Agreement", "Agreement to sign: cash", () =>
    sendAgreementToSign(KEY, {
      ownerNames: "Chris Whitfield",
      address: ADDR,
      email: HOME,
      url: "https://poweredgetx.com/sign/preview",
      rep: "Zach Delgado",
      total: "13500",
      claimBased: false,
      scope: [
        { description: "Tear off and replace roof, 24 squares at $500.00 per square", price: "12000" },
        { description: "Seamless gutters, front and back", price: "1500" },
      ],
    }),
  );
  await take("Agreement", "Signed copy with cancellation notice", () =>
    sendSignedAgreement(KEY, {
      id: "00000000-0000-0000-0000-000000000000",
      ownerNames: "Chris Whitfield",
      address: ADDR,
      email: HOME,
      scope: [
        { description: "Tear off and replace roof, 32 squares at $550.00 per square", price: "17600" },
        { description: "Seamless gutters, front and back", price: "2400" },
      ],
      total: "20000",
      claimBased: true,
      carrier: "Allstate",
      claimNumber: "0784412-TX",
      deductible: "5000",
      signedOn: "November 12, 2026",
      cancelBy: "November 17, 2026",
    }),
  );
  await take("Claim prep", "Claim details received", () =>
    sendClaimComplete(KEY, HOME, "Chris Whitfield"),
  );
  await take("Claim prep", "Unfinished claim, first nudge", () =>
    sendClaimNurture(KEY, { id: "x", name: "Chris Whitfield", email: HOME }, 1),
  );
  // Sample lead said the deductible is a problem, so every email shows,
  // including the ones only that kind of lead gets.
  for (const e of leadSequence) {
    const day = e.delayDays === 0 ? "Sent instantly" : `Day ${e.delayDays}`;
    out.push({
      group: "Lead follow-up",
      label: e.when ? `${day}, only if they said the deductible is a problem` : day,
      subject: e.subject(lead),
      html: e.html(lead),
    });
  }
  return out;
}

export default async function EmailPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    const user = await currentUser();
    if (user?.role !== "admin") notFound();
  }
  const emails = await render();

  return (
    <div style={{ background: "#eef0ec", minHeight: "100vh", padding: "32px 16px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", fontFamily: "Inter, system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0b0e13", margin: 0 }}>
          Customer emails
        </h1>
        <p style={{ color: "#5b6472", fontSize: 14, marginTop: 6 }}>
          {emails.length} emails, rendered by the real send code with sample data. Each is shown
          at phone width and desktop width.
        </p>
        {emails.map((e, i) => (
          <section key={i} id={`e${i}`} style={{ marginTop: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#0c7a40" }}>
              {e.group} · {e.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#0b0e13", margin: "4px 0 12px" }}>
              {e.subject}
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
              <iframe
                title={`${e.label} phone`}
                srcDoc={e.html}
                style={{ width: 375, height: 760, border: "1px solid #d7dbe0", borderRadius: 16, background: "#fff" }}
              />
              <iframe
                title={`${e.label} desktop`}
                srcDoc={e.html}
                style={{ flex: "1 1 640px", minWidth: 320, height: 760, border: "1px solid #d7dbe0", borderRadius: 8, background: "#fff" }}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
