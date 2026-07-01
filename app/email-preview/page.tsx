import type { Metadata } from "next";
import { leadSequence, type LeadEmailCtx } from "@/lib/emails";

// Internal preview of the lead email funnel — NOT indexed. Renders each email
// in the sequence exactly as it sends, so the design can be reviewed live.
export const metadata: Metadata = {
  title: "Email Funnel Preview",
  robots: { index: false, follow: false },
};

const sample: LeadEmailCtx = {
  firstName: "Chris",
  service: "Roof claim check (LIKELY QUALIFIES)",
  solar: true,
  financing: true,
};

export default function EmailPreviewPage() {
  return (
    <div style={{ background: "#0b0e13", minHeight: "100vh", padding: "40px 16px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: "Archivo, sans-serif",
            color: "#fff",
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          Lead email funnel — {leadSequence.length} touches
        </h1>
        <p style={{ color: "#9aa3b0", fontFamily: "Inter, sans-serif", fontSize: 14 }}>
          Sample lead: solar + financing flags on, so the conditional blocks show.
          Timing is measured from the moment a lead comes in.
        </p>

        {leadSequence.map((email) => (
          <div key={email.key} style={{ marginTop: 36 }}>
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                color: "#7FFBAE",
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {email.delayDays === 0 ? "Sent instantly" : `Day ${email.delayDays}`}
            </div>
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                color: "#fff",
                fontSize: 16,
                fontWeight: 600,
                margin: "4px 0 12px",
              }}
            >
              Subject: {email.subject(sample)}
            </div>
            <iframe
              title={email.key}
              srcDoc={email.html(sample)}
              style={{
                width: "100%",
                height: 720,
                border: "1px solid #2a2f38",
                borderRadius: 12,
                background: "#fff",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
