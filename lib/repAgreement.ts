/**
 * The independent contractor agreement a rep signs in onboarding.
 *
 * DRAFT for attorney review. Compensation is the plan Parker locked on
 * 2026-07-21 (50% / 30% of gross profit, $1,250 floor, forgivable ramp draw,
 * accelerator, pay timing). How a knocker is paid when a closer signs the
 * roof was never set, so that line says the office will put it in writing;
 * replace it once decided.
 *
 * While AGREEMENT_STATUS is "draft", reps can read it but not sign it. Flip to
 * "final" (and bump AGREEMENT_VERSION) once counsel has cleared the text.
 * A rep who signed an older version is asked to sign the new one.
 */

export const AGREEMENT_STATUS: "draft" | "final" = "draft";
export const AGREEMENT_VERSION = "2026-11-11 draft";

export type Section = { h: string; p: string[] };

export const AGREEMENT_TITLE = "Independent Sales Representative Agreement";

export function agreementSections(repName: string): Section[] {
  const who = repName.trim() || "the Representative";
  return [
    {
      h: "1. Who this is between",
      p: [
        `This agreement is between Power Edge, LLC, a Texas company ("PowerEdge"), PO Box 600715, Dallas, TX 75206, and ${who} ("you").`,
      ],
    },
    {
      h: "2. You are an independent contractor",
      p: [
        "You are not an employee. You decide your own hours, methods and territory within the areas PowerEdge offers, and you may work for others who do not compete with PowerEdge for the same homeowners.",
        "PowerEdge does not withhold taxes. You are responsible for your own income and self-employment taxes, and PowerEdge will issue you a Form 1099 each year. You provide a completed Form W-9 before your first payment.",
        "You pay your own expenses (vehicle, fuel, phone) unless PowerEdge agrees in writing to cover something. You carry your own auto insurance while driving for this work.",
      ],
    },
    {
      h: "3. What you do",
      p: [
        "Depending on your role, you knock doors and book free roof inspections, or you run inspections, price work and present PowerEdge's repair agreement, using the tools and materials PowerEdge provides.",
        "You represent PowerEdge honestly: what the inspection found, what the work will cost, and what the homeowner's rights are. You never pressure a homeowner to sign.",
      ],
    },
    {
      h: "4. The law, and PowerEdge's rules",
      p: [
        "You never offer to waive, pay, rebate or absorb a homeowner's insurance deductible, in any form. In Texas that is a crime (Tex. Bus. & Com. Code § 27.02).",
        "You never act as, or say you are, a public adjuster, and you never negotiate a claim for a homeowner. The homeowner files and speaks for their claim; PowerEdge documents damage and may discuss its findings with the carrier's adjuster (Tex. Ins. Code § 4102.163).",
        "You never call PowerEdge, or yourself, a licensed roofer. Texas does not license roofers. You may say PowerEdge is insured and stands behind its work.",
        "You hold the solicitor permit each city requires before you knock there, carry it, and show it when asked. You honor No Soliciting signs and each city's hours.",
        "You do not call or text a number marked Do Not Call, and you never sign a homeowner up for texts; they must agree themselves.",
        "Every homeowner who signs at their door gets their copy and their written right to cancel before you leave.",
        "Breaking these rules is grounds to end this agreement immediately, and you are responsible for fines issued to you personally.",
      ],
    },
    {
      h: "5. How you are paid",
      p: [
        "PowerEdge pays commission on gross profit (the contract amount PowerEdge collects, less the cost of the job), on approved roofs, as set out in the Compensation Schedule below.",
        "Commission is earned only when PowerEdge is paid. If a homeowner cancels, a claim is denied, or a job is refunded, any commission already paid on that job is deducted from future commissions.",
      ],
    },
    {
      h: "Compensation Schedule",
      p: [
        "Self-generated roofs (you found and closed it): 50% of gross profit.",
        "Company-provided leads you close: 30% of gross profit.",
        "Floor: at least $1,250 per approved roof you close, even on thin margins.",
        "Accelerator: from your 6th self-generated roof in a calendar month, 55% of gross profit on each further self-generated roof that month. Resets each month.",
        "Ramp draw: $600 a week for your first 6 weeks. It is forgiven if you have 4 approved roofs by the end of week 8; otherwise it is recovered from later commissions.",
        "Timing: 50% of your commission when PowerEdge receives the first insurance payment (or the deposit on a cash job), and 50% at completion.",
        "Knockers on a team: when a roof you booked is closed by another rep, your share is set out in writing by PowerEdge before you start.",
      ],
    },
    {
      h: "6. Customers, leads and information",
      p: [
        "Leads, homeowner information, storm data, pricing and the PowerEdge portal belong to PowerEdge. Use them only for PowerEdge work, never share them, and do not keep copies when this agreement ends.",
        "For 12 months after this agreement ends, you will not use PowerEdge's leads or homeowner information to sell roofing to those homeowners for anyone else.",
      ],
    },
    {
      h: "7. Ending this agreement",
      p: [
        "Either of us may end this agreement at any time with written notice (email is fine). Commission on roofs you closed before the end date is paid on the normal schedule as PowerEdge is paid.",
      ],
    },
    {
      h: "8. The rest",
      p: [
        "Texas law governs this agreement. It is the whole agreement between us on this subject, and changes must be in writing. If a court finds part of it unenforceable, the rest still applies.",
        "You agree to sign electronically, and that your typed name and signature below have the same effect as signing on paper.",
      ],
    },
  ];
}

/** The text as signed, kept with the signature. */
export function agreementPlainText(repName: string) {
  return [
    `${AGREEMENT_TITLE} (version ${AGREEMENT_VERSION})`,
    ...agreementSections(repName).flatMap((s) => [s.h, ...s.p]),
  ].join("\n\n");
}
