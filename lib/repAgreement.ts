/**
 * The independent contractor agreement a rep signs in onboarding.
 *
 * APPROVED by PowerEdge's attorney 2026-11-12 (version "2026-11-12"), word
 * for word as print/CONTRACTOR-AGREEMENT-DRAFT-FOR-COUNSEL.docx (draft 2).
 * Any change to the text or the numbers below goes back to counsel and ships
 * as a new AGREEMENT_VERSION, which every rep signs again in the app.
 *
 * One agreement with a pay schedule for each role. It merges the 2026-08-07 Commission & Advance Addendum (fixed $275
 * per square, approved-roof and chargeback rules, non-recourse advance) into
 * the onboarding agreement, and adds knocker pay (Parker, 2026-11-11):
 *
 *   Knocker   15% of gross profit on roofs they book, $500 minimum, plus $50
 *             per held inspection as an advance against that roof's commission
 *   Closer    30%, or 35% on roofs booked by a knocker on their own team (the
 *             closer runs the team); 50% self-generated, 55% from the 6th in a
 *             month; $1,250 minimum; ramp advance
 *   Leaders   team or regional overrides come out of PowerEdge's share and
 *             never reduce a rep's commission (terms in a separate addendum)
 *
 * While AGREEMENT_STATUS is "draft", reps can read it but not sign it. Flip to
 * "final" (and bump AGREEMENT_VERSION) once counsel has cleared the text; every
 * rep in onboarding is then emailed to sign. A rep who signed an older version
 * is asked to sign the new one.
 */

export const AGREEMENT_STATUS: "draft" | "final" = "final";
export const AGREEMENT_VERSION = "2026-11-12";

export type Section = { h: string; p: string[] };

export const AGREEMENT_TITLE = "Independent Sales Representative Agreement";

/** Every number in the pay schedule, in one place. */
export const COMP = {
  costPerSquare: 275,
  selfGen: 50,
  accelerator: 55,
  acceleratorFrom: 6,
  companyLead: 30,
  ownTeam: 35,
  closerFloor: 1250,
  knocker: 15,
  knockerFloor: 500,
  heldInspection: 50,
  advance: { weekly: 600, weeks: 6, forgiveAtRoofs: 4, byWeek: 8 },
  /** The illustration: a typical DFW roof. */
  example: { squares: 28, perSquare: 600 },
};

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export type PayRole = "knocker" | "closer";
/** Knockers (setter) get the knocker schedule; everyone who sells gets the closer's. */
export const payRoleOf = (role: string): PayRole => (role === "setter" ? "knocker" : "closer");

function example() {
  const { squares, perSquare } = COMP.example;
  const collected = squares * perSquare;
  const gp = collected - squares * COMP.costPerSquare;
  return { squares, perSquare, collected, gp };
}

function schedule(role: PayRole): string[] {
  const e = example();
  const intro = `Example (an illustration, not a promise): a ${e.squares}-square roof at ${usd(e.perSquare)} a square collects ${usd(e.collected)}. Gross profit is ${usd(e.collected)} minus ${e.squares} × ${usd(COMP.costPerSquare)}, or ${usd(e.gp)}.`;
  if (role === "knocker") {
    return [
      "Your role: Knocker.",
      `Roofs you book that are approved: ${COMP.knocker}% of gross profit, and at least ${usd(COMP.knockerFloor)} for each one that is installed.`,
      `Held inspections: ${usd(COMP.heldInspection)} for each inspection you booked that is held, paid on the weekly commission run. "Held" means the homeowner was there, the closer completed the inspection with photos in the PowerEdge app, and it was the first inspection PowerEdge ran at that address.`,
      `The ${usd(COMP.heldInspection)} is an advance against that roof's commission. If the roof is approved, it comes off your commission on that roof. If it isn't, you keep it.`,
      intro,
      `On that roof you would earn ${usd((e.gp * COMP.knocker) / 100)}: the ${usd(COMP.heldInspection)} already paid for the inspection, and ${usd((e.gp * COMP.knocker) / 100 - COMP.heldInspection)} more once the roof is approved and PowerEdge is paid.`,
    ];
  }
  const a = COMP.advance;
  return [
    "Your role: Closer.",
    `Roofs you find and close yourself: ${COMP.selfGen}% of gross profit. From your ${ordinal(COMP.acceleratorFrom)} self-generated approved roof in a calendar month, ${COMP.accelerator}% on that roof and each one after it that month. The count starts over on the 1st.`,
    `Roofs booked by a knocker on your team: ${COMP.ownTeam}% of gross profit (${COMP.companyLead}%, plus ${COMP.ownTeam - COMP.companyLead}% for running the team).`,
    `Roofs from company leads, or booked by a knocker on another team: ${COMP.companyLead}% of gross profit.`,
    `Minimum: at least ${usd(COMP.closerFloor)} for each approved roof you close that is installed, even when the percentage comes to less.`,
    `Ramp advance: ${usd(a.weekly)} a week for your first ${a.weeks} weeks (${usd(a.weekly * a.weeks)} at most), as an advance against commission. Your commissions repay it first. If you have ${a.forgiveAtRoofs} approved roofs by the end of week ${a.byWeek}, whatever is left of it is forgiven. If this agreement ends before it is repaid, you owe nothing: it is recovered only from commissions, never from you personally. PowerEdge may change or stop the advance for closers who start later, but never for you once it has started.`,
    intro,
    `On that roof you would earn ${usd((e.gp * COMP.selfGen) / 100)} if you found it yourself, ${usd((e.gp * COMP.ownTeam) / 100)} if a knocker on your team booked it, and ${usd((e.gp * COMP.companyLead) / 100)} otherwise.`,
  ];
}

function ordinal(n: number) {
  return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
}

export function agreementSections(repName: string, role: string): Section[] {
  const who = repName.trim() || "the Representative";
  const pay = payRoleOf(role);
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
        "You are not an employee. This section controls if anything else in this agreement, or anything PowerEdge pays you, seems to say otherwise.",
        "PowerEdge sets the results it wants: approved roofs, honest dealing and following the law. It does not set your hours, routes or methods. You decide when and how you work, within the areas PowerEdge offers.",
        "Everything PowerEdge pays you is commission, or an advance against commission. None of it is a wage, a salary, a bonus or guaranteed pay.",
        "PowerEdge does not withhold taxes. You pay your own income and self-employment taxes. PowerEdge reports what it pays you on Form 1099-NEC, and you give PowerEdge a completed Form W-9 before your first payment. You receive no employee benefits.",
        "You pay your own expenses (vehicle, fuel, phone) unless PowerEdge agrees in writing to cover something, and you carry your own auto insurance while driving for this work.",
        "You may work for others. You may not use PowerEdge's leads, homeowner information or tools for anyone else (sections 6 and 7).",
      ],
    },
    {
      h: "3. What you do",
      p: [
        pay === "knocker"
          ? "You knock doors in storm-hit neighborhoods and book free roof inspections in the PowerEdge app for a closer to run. You don't price work or sign homeowners to agreements."
          : "You run roof inspections, price work and present PowerEdge's repair agreement, using the tools and materials PowerEdge provides. You may also find your own homeowners.",
        pay === "knocker"
          ? "You represent PowerEdge honestly: who you are, why you're at the door, and that the inspection is free with no obligation. You never pressure a homeowner."
          : "You represent PowerEdge honestly: what the inspection found, what the work will cost, and what the homeowner's rights are. You never pressure a homeowner to sign.",
      ],
    },
    {
      h: "4. The law, and PowerEdge's rules",
      p: [
        "You never offer to waive, pay, rebate or absorb a homeowner's insurance deductible, in any form. In Texas that is a crime (Tex. Bus. & Com. Code § 27.02).",
        "You never act as, or say you are, a public adjuster, and you never negotiate, adjust or file a claim for a homeowner. The homeowner files and speaks for their own claim. PowerEdge documents damage and may discuss its findings with the insurer's adjuster (Tex. Ins. Code ch. 4102, including § 4102.163).",
        "You never call PowerEdge, or yourself, a licensed roofer. Texas does not license roofers. You may say PowerEdge is insured and stands behind its work.",
        "You hold the solicitor permit each city requires before you knock there, carry it, and show it when asked. You honor No Soliciting signs and each city's hours.",
        "You do not call or text a number marked Do Not Call, and you never sign a homeowner up for texts; they must agree themselves.",
        "Every homeowner who signs at their door gets their copy and their written right to cancel before you leave.",
        "Breaking these rules is grounds to end this agreement immediately, and you are responsible for fines issued to you personally.",
      ],
    },
    {
      h: "5. How commission works",
      p: [
        `Gross profit is everything PowerEdge collects for a roof, including insurance payments, approved supplements and what the homeowner pays, minus a fixed ${usd(COMP.costPerSquare)} for each roofing square installed. The ${usd(COMP.costPerSquare)} is a fixed figure used only to calculate commission. PowerEdge does not change it after a roof is sold.`,
        "A roof is approved when the insurer (or, on a cash job, the homeowner) has approved the scope and the roof is contracted with PowerEdge for installation. Signing a homeowner is not enough on its own.",
        "Commission is earned as PowerEdge is paid: half when PowerEdge receives the first insurance check (or the first payment on a cash job), and the other half when the roof is complete and PowerEdge has collected the balance. PowerEdge pays earned commission on its weekly commission run.",
        "If a roof is canceled, isn't built, or PowerEdge isn't paid in full (including a payment that is returned or reversed), commission paid on it was not earned and is taken back from your future commissions. This corrects unearned commission; it is not a debt.",
        "The PowerEdge app records who booked each inspection and who closed each roof, and that record decides who is paid. If you think it's wrong, tell the office in writing within 30 days of the roof's approval.",
        "PowerEdge may pay team or regional leaders an override on roofs their teams produce. Overrides come out of PowerEdge's share and never reduce your commission.",
      ],
    },
    { h: "Compensation Schedule", p: schedule(pay) },
    {
      h: "6. Customers, leads and information",
      p: [
        "Leads, homeowner information, storm data, pricing and the PowerEdge app belong to PowerEdge. Use them only for PowerEdge work, never share them, and do not keep copies when this agreement ends.",
      ],
    },
    {
      h: "7. After this agreement ends",
      p: [
        "For 12 months after this agreement ends, you will not use PowerEdge's leads or homeowner information to sell roofing to those homeowners for anyone else. Nothing in this agreement stops you from working in roofing sales.",
      ],
    },
    {
      h: "8. Ending this agreement",
      p: [
        "Either of us may end this agreement at any time with written notice (email is fine).",
        "Roofs you booked or closed before the end date are still paid on the normal schedule, once they are approved and PowerEdge is paid. Any advance not yet repaid is not owed.",
      ],
    },
    {
      h: "9. The rest",
      p: [
        "Texas law governs this agreement. It is the whole agreement between us on this subject. Changes must be in writing; PowerEdge will ask you to sign any new version in the app. If a court finds part of it unenforceable, the rest still applies.",
        "You agree to sign electronically, and that your typed name and signature below have the same effect as signing on paper. You'll be emailed a copy when you sign, and you can open it in the app any time.",
      ],
    },
  ];
}

/** The text as signed, kept with the signature. */
export function agreementPlainText(repName: string, role: string) {
  return [
    `${AGREEMENT_TITLE} (version ${AGREEMENT_VERSION})`,
    ...agreementSections(repName, role).flatMap((s) => [s.h, ...s.p]),
  ].join("\n\n");
}
