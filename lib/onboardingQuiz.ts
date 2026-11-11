/**
 * The compliance check every rep passes before their first door.
 *
 * Built on the rules the playbook is built on, verified against statute and
 * TDI guidance (Tex. Bus. & Com. Code § 27.02, Tex. Ins. Code § 4102.163,
 * no state roofing license), the city permit rules checked on 2026-11-10,
 * and PowerEdge's own house rules (the honest verdict, financing only when
 * the homeowner raises the deductible). All ten right to pass; retakes are
 * unlimited and each miss explains the rule.
 *
 * Answers stay on the server: the page gets the questions and choices only.
 */

export type QuizQuestion = {
  id: string;
  q: string;
  choices: string[];
  answer: number;
  why: string;
};

export const QUIZ: QuizQuestion[] = [
  {
    id: "deductible",
    q: "A homeowner asks if PowerEdge can cover or knock off their insurance deductible. What do you say?",
    choices: [
      "Yes, if they sign today.",
      "No. Texas law requires them to pay it, and waiving it is a crime.",
      "We can add it to the claim as extra damage.",
    ],
    answer: 1,
    why: "Waiving, paying, rebating or hiding a deductible is a crime in Texas (Bus. & Com. Code § 27.02), however it is dressed up.",
  },
  {
    id: "adjuster",
    q: "The homeowner asks you to handle their insurance claim for them. What is right?",
    choices: [
      "Tell them we negotiate with the insurance company on their behalf.",
      "They file and speak for the claim. We document the damage and can walk the adjuster through what we found.",
      "Call the insurance company yourself and file it in their name.",
    ],
    answer: 1,
    why: "A contractor may not act as a public adjuster on a job it may do (Ins. Code § 4102.163). The line to remember: you file it, I document it.",
  },
  {
    id: "license",
    q: "Can you tell a homeowner PowerEdge is a licensed roofer?",
    choices: [
      "Yes, it builds trust.",
      "Only if they ask.",
      "No. Texas does not license roofers. Say we are insured and stand behind our work.",
    ],
    answer: 2,
    why: "Texas has no roofing license, so 'licensed roofer' is a false claim. PowerEdge carries liability insurance and a written workmanship guarantee.",
  },
  {
    id: "no-soliciting",
    q: "A house has a No Soliciting sign. What do you do?",
    choices: [
      "Knock anyway; storm work is different.",
      "Skip it, and mark it on the knock map so nobody else knocks.",
      "Leave a door hanger in the door.",
    ],
    answer: 1,
    why: "Cities fine solicitors who ignore No Soliciting signs, and it is the fastest way to earn a complaint. Mark it and move on.",
  },
  {
    id: "permit",
    q: "You are about to knock in Garland. What do you need first?",
    choices: [
      "Garland's solicitor permit, on you and shown when asked.",
      "Nothing; a Dallas permit covers the metro.",
      "Just your PowerEdge shirt.",
    ],
    answer: 0,
    why: "Permits are by city limits, each city issues its own, and the ticket (up to $500) goes to the rep.",
  },
  {
    id: "verdict",
    q: "You inspect a roof and find no storm damage. What happens?",
    choices: [
      "Find something small so the claim can go in.",
      "Tell them the roof is fine, and they get that in writing.",
      "Tell them to file anyway and see what the adjuster says.",
    ],
    answer: 1,
    why: "The honest verdict is the whole reason homeowners trust PowerEdge. A 'your roof is fine' report is a promise we keep.",
  },
  {
    id: "cancel",
    q: "A homeowner signs the repair agreement at their door. Before you leave, they must have:",
    choices: [
      "Nothing until the job starts.",
      "Their copy, including their written right to cancel within three business days.",
      "A verbal promise that they can cancel.",
    ],
    answer: 1,
    why: "Every door-signed deal carries the written cancellation notice, and the homeowner leaves with their copy.",
  },
  {
    id: "financing",
    q: "When do you bring up deductible financing?",
    choices: [
      "At the start of every pitch.",
      "When the homeowner tells you the deductible is a problem.",
      "Never; it is only on the website.",
    ],
    answer: 1,
    why: "PowerEdge's rule: financing is a tool for a homeowner who raises the deductible, not an opener.",
  },
  {
    id: "dnc",
    q: "The knock map shows a homeowner's phone number marked Do Not Call. What do you do?",
    choices: [
      "Call once; it is a follow-up.",
      "Text instead of calling.",
      "Do not call or text it. Knock the door instead.",
    ],
    answer: 2,
    why: "Do Not Call numbers are off limits for calls and texts. That is why PowerEdge is a door operation.",
  },
  {
    id: "texts",
    q: "A homeowner wants storm alerts but is busy. Can you sign them up on your phone for them?",
    choices: [
      "Yes, type in their number and check the box.",
      "No. They tick the consent box and type their own name to sign.",
      "Yes, if they say it out loud.",
    ],
    answer: 1,
    why: "Texting needs the homeowner's own written consent. Hand them the phone; never agree for them.",
  },
];

export function grade(answers: Record<string, number>) {
  const misses = QUIZ.filter((q) => answers[q.id] !== q.answer).map((q) => ({ id: q.id, q: q.q, why: q.why }));
  return { score: QUIZ.length - misses.length, of: QUIZ.length, passed: misses.length === 0, misses };
}

/** What the page may see: no answers. */
export const quizForClient = () => QUIZ.map(({ id, q, choices }) => ({ id, q, choices }));
