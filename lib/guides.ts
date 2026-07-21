// Cornerstone content for SEO + AI-answer-engine citation. Question-based
// headings with concise, extractable answers (what LLMs quote and what ranks).
// All facts grounded in verified research — no fabricated stats. Edit copy here.

export type GuideSection = { h: string; p: string[]; bullets?: string[] };
export type Guide = {
  slug: string;
  title: string; // <title>
  h1: string;
  description: string;
  category: string;
  datePublished: string;
  readMins: number;
  intro: string;
  sections: GuideSection[];
  faqs: { q: string; a: string }[];
  cta: { heading: string; sub: string };
};

export const guides: Guide[] = [
  {
    slug: "roof-replacement-cost-dallas-fort-worth",
    title: "How Much Does a Roof Replacement Cost in Dallas–Fort Worth? (2026)",
    h1: "How much does a roof replacement cost in Dallas–Fort Worth?",
    description:
      "A straight answer on DFW roof replacement cost in 2026 — how roofing is priced by the square, what changes the price, and how to get an exact number from your address.",
    category: "Cost guide",
    datePublished: "2026-06-30",
    readMins: 5,
    intro:
      "Most roofers won't give you a number until a salesperson is in your living room. We'll just tell you how it works — and you can measure your own roof in seconds with our instant estimator.",
    sections: [
      {
        h: "What does a new roof cost in DFW?",
        p: [
          "Roofing is priced by the \"square\" — one square equals 100 square feet of roof surface. In the Dallas–Fort Worth area, a quality architectural asphalt shingle roof installed typically runs about $400–$450 per square at PowerEdge, all-in.",
          "A typical single-story home has roughly 20–35 squares of roof once pitch and overhangs are counted, so most asphalt re-roofs land in a broad range — which is exactly why a real measurement matters more than a phone guess.",
        ],
      },
      {
        h: "What is a \"roofing square,\" and how many will my roof need?",
        p: [
          "A roofing square is 100 sq ft of actual roof surface — not floor space. Your roof area is larger than your home's footprint because of pitch (slope) and overhangs.",
          "Our instant estimator measures your roof's true surface area from satellite imagery, divides by 100 to get squares, adds about 10% for waste and cuts, and multiplies by our per-square rate. You get a ballpark in seconds, no sales call.",
        ],
      },
      {
        h: "What changes the price of a roof?",
        p: ["A few factors move the number up or down:"],
        bullets: [
          "Size — more squares, more cost (the biggest driver).",
          "Pitch — steeper roofs are slower and more dangerous to work, so they cost more.",
          "Material — architectural asphalt vs. premium designer shingles, metal, or tile.",
          "Tear-off — removing one or more existing layers and hauling them off.",
          "Decking — rotten or damaged decking under the shingles must be replaced.",
          "Access and complexity — valleys, dormers, steep multi-story sections, and tight access.",
        ],
      },
      {
        h: "Will insurance pay for my new roof?",
        p: [
          "Often, yes. If your roof was damaged by hail or wind, a Texas homeowners policy frequently covers the replacement — and you typically pay only your deductible, not the full retail price.",
          "The catch is timing and documentation. See our guide on Texas hail-damage insurance claims for the honest step-by-step, including the rules a legitimate contractor follows.",
        ],
      },
      {
        h: "How do I get an exact price?",
        p: [
          "An instant estimate gets you a ballpark; an exact price comes from a free on-site measurement where we confirm the roof, the decking, and the scope. There's no charge and no obligation — and if a repair is the honest fix instead of a replacement, we'll tell you.",
        ],
      },
    ],
    faqs: [
      {
        q: "How much is a new roof in Dallas–Fort Worth in 2026?",
        a: "Quality architectural asphalt shingle roofs at PowerEdge run about $400–$450 per roofing square installed. Total cost depends on your roof's size, pitch, material, and tear-off — measure yours instantly with our roof estimator for a real ballpark.",
      },
      {
        q: "What is a roofing square?",
        a: "A roofing square is 100 square feet of roof surface. Roofs are priced per square. Your roof has more squares than your home's floor area because of pitch and overhangs.",
      },
      {
        q: "Is a roof estimate from my address accurate?",
        a: "Our estimator measures your roof's surface area from satellite imagery, so the square count is accurate. The dollar range is a ballpark — your exact price is confirmed with a free on-site measurement.",
      },
    ],
    cta: {
      heading: "See your roof's cost in seconds.",
      sub: "Enter your address — we measure your roof from satellite imagery and give you an honest range on the spot.",
    },
  },

  {
    slug: "hail-damage-roof-insurance-claim-texas",
    title: "Hail Damage Roof Insurance Claims in Texas: An Honest Step-by-Step",
    h1: "Hail damage roof insurance claims in Texas: the honest guide",
    description:
      "How Texas roof insurance claims actually work after hail — RCV vs. actual-cash-value, the two-check process, deadlines, and the rules a legitimate contractor must follow.",
    category: "Insurance",
    datePublished: "2026-06-30",
    readMins: 6,
    intro:
      "A storm claim is where homeowners get burned by fly-by-night roofers. Here's how the process actually works in Texas — and how to spot a contractor who's breaking the law.",
    sections: [
      {
        h: "Do I even have a claim?",
        p: [
          "If hail or high wind has hit your area, your roof may have damage that's invisible from the ground — bruised, cracked, or fractured shingles that still let water in over time.",
          "Start by checking whether significant hail was reported near your address, then get a professional inspection to document it. Our free storm check pulls reported hail near your home straight from National Weather Service data.",
        ],
      },
      {
        h: "RCV vs. ACV: how Texas roof policies pay",
        p: [
          "Texas roof policies generally pay one of two ways. Replacement-cost value (RCV) pays up to the full current cost to replace your roof. Actual-cash-value (ACV) pays less, deducting for the roof's age and wear.",
          "Important: as roofs age, many insurers switch them from RCV to ACV — so an older roof may be worth far less on a claim than you expect. It's worth knowing which coverage you have before a storm, not after.",
        ],
      },
      {
        h: "How does the payout work? (The two-check process)",
        p: [
          "Under replacement-cost coverage, Texas insurers typically pay in two checks. The first is a partial payment based on the depreciated value; the balance (the \"recoverable depreciation\") is released after the work has begun and is verified.",
          "That means you don't get one lump sum up front — and a contractor who understands this will walk you through exactly what to expect.",
        ],
      },
      {
        h: "What a legitimate contractor legally CANNOT do",
        p: [
          "Texas law is strict here, and these rules protect you. A contractor who breaks them is a red flag:",
        ],
        bullets: [
          "They cannot offer to waive, rebate, or \"eat\" your insurance deductible — it's a crime in Texas (a Class B misdemeanor).",
          "They cannot act as your public insurance adjuster on a job they're also being paid to repair.",
          "They shouldn't pressure you to sign over your claim or sign a contract before you understand the scope.",
        ],
      },
      {
        h: "Is there a deadline to file?",
        p: [
          "Usually, yes. Many Texas policies require you to file a claim within a set window — often around a year from the date of loss — and once it closes, you pay for the roof yourself. Check your specific policy, and don't sit on suspected storm damage.",
        ],
      },
      {
        h: "How a claim works with PowerEdge",
        p: [
          "We document the damage with photos and measurements, work directly with your adjuster, and do it all by the book — no deductible games, no posing as your adjuster. Just an honest claim and a roof done right, backed by a licensed contractor you can verify.",
        ],
      },
    ],
    faqs: [
      {
        q: "Will my Texas homeowners insurance pay for a hail-damaged roof?",
        a: "Often yes — if you have replacement-cost coverage and file a valid claim, you typically pay only your deductible. Aging roofs may be on actual-cash-value coverage, which pays less. An inspection documents whether you have a claim.",
      },
      {
        q: "Can a roofer waive my insurance deductible in Texas?",
        a: "No. It's illegal in Texas for a contractor to offer to waive, rebate, or absorb your deductible — it's a Class B misdemeanor. Any roofer who offers is breaking the law and putting you at risk.",
      },
      {
        q: "How long do I have to file a roof insurance claim in Texas?",
        a: "It depends on your policy, but many require filing within about a year of the date of loss. Don't wait — check your policy and get the damage documented promptly.",
      },
      {
        q: "Why does insurance pay in two checks?",
        a: "Under replacement-cost coverage, insurers release a first partial check based on depreciated value, then the remaining recoverable depreciation after repairs begin and are verified.",
      },
    ],
    cta: {
      heading: "Think hail hit your roof?",
      sub: "Check your address for reported hail free, then book a no-pressure inspection. We document your damage by the book.",
    },
  },

  {
    slug: "is-my-roofer-licensed-in-texas",
    title: "Is My Roofer Licensed in Texas? (The Honest Answer)",
    h1: "Is my roofer licensed in Texas?",
    description:
      "The honest answer: Texas does not license roofers, so anyone can call themselves one. Here's how to actually vet a roofer — and the one credential you can truly verify.",
    category: "Hiring guide",
    datePublished: "2026-06-30",
    readMins: 4,
    intro:
      "Short version: in Texas, the bar to call yourself a roofer is owning a ladder. Here's how to protect yourself — and the credential that actually means something.",
    sections: [
      {
        h: "Does Texas license roofers?",
        p: [
          "No. Texas does not license or register roofers at the state level. There is no state roofing license to look up, and anyone can legally call themselves a roofer — no exam, no insurance requirement, nothing. That's exactly why storm-chasers flood the state after every hailstorm.",
        ],
      },
      {
        h: "So how do I actually vet a roofer?",
        p: ["Since the state won't vet them for you, do it yourself:"],
        bullets: [
          "Voluntary certification — look for RCAT (Roofing Contractors Association of Texas) certification, which requires passing exams.",
          "Local registration — some cities require roofers to register; ask.",
          "Insurance — confirm general liability and workers' comp, and get the certificate.",
          "A real local address and history — not just a magnet sign and an out-of-state phone number.",
          "Reviews and references — recent, specific, local reviews you can read.",
        ],
      },
      {
        h: "What CAN you actually verify in Texas?",
        p: [
          "Electrical work is different. Electricians ARE regulated by the Texas Department of Licensing and Regulation (TDLR), and their licenses are publicly verifiable. So if a company also does electrical or solar work, you can look up their electrical contractor license and confirm it's real.",
          "PowerEdge is a licensed, insured Texas electrical contractor, and we run our roofing under that same accountable company — a real business standing behind the work, not a magnet sign on a truck.",
        ],
      },
      {
        h: "Red flags to walk away from",
        p: ["A few signs you're dealing with a storm-chaser, not a contractor:"],
        bullets: [
          "They offer to waive or \"eat\" your insurance deductible (that's illegal in Texas).",
          "High-pressure, sign-today tactics right on your doorstep.",
          "No verifiable local address, license, or insurance.",
          "They want you to sign over your insurance claim.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do roofers need a license in Texas?",
        a: "No. Texas does not license or register roofers at the state level, so anyone can call themselves a roofer. Vet them yourself via RCAT certification, city registration, insurance, and reviews.",
      },
      {
        q: "How can I verify a contractor's license in Texas?",
        a: "You can verify electricians through the Texas Department of Licensing and Regulation (TDLR) public portal — electrical work is state-regulated. Roofing is not, so there is no state roofer license to check.",
      },
      {
        q: "Is PowerEdge licensed?",
        a: "Yes — PowerEdge is a licensed, insured Texas electrical contractor, and runs its roofing under that same company.",
      },
    ],
    cta: {
      heading: "Hire a crew you can actually verify.",
      sub: "Licensed Texas electrical contractor that also does your roof. Get a free, no-pressure inspection.",
    },
  },

  {
    slug: "roof-deductible-financing-texas",
    title: "Can't Cover Your Roof Deductible? How Financing Works in Texas",
    h1: "How roof deductible financing works in Texas",
    description:
      "If a storm damaged your roof, you pay your deductible and insurance covers the rest — and you can finance that deductible into monthly payments. Here's how it works, and why it's legal.",
    category: "Insurance",
    datePublished: "2026-06-30",
    readMins: 4,
    intro:
      "A storm claim means you usually pay only your deductible. But if even that's tough to cover up front, you don't have to wait — here's how deductible financing lets you get your roof replaced now.",
    sections: [
      {
        h: "Do I have to pay my deductible?",
        p: [
          "Yes. By Texas law you must pay your full insurance deductible on a roof claim — there's no legal way around it. Any contractor who offers to \"waive,\" \"eat,\" or \"cover\" your deductible is breaking the law (HB 2102) and putting you at risk. We don't do that.",
        ],
      },
      {
        h: "What is deductible financing?",
        p: [
          "Deductible financing is simply a payment plan for your deductible. Instead of paying the whole amount up front, you spread it into smaller monthly payments — but you still pay it in full. It's financing, not waiving, which is exactly why it's legal and legitimate.",
        ],
      },
      {
        h: "Why finance my deductible?",
        p: [
          "Two reasons. First, timing: storm damage gets worse with every rain, and Texas claims have filing deadlines — financing lets you get the roof done now instead of waiting until you've saved the full deductible. Second, cash flow: a new roof for low monthly payments (often with little or nothing down) is easier on your budget than a lump sum.",
        ],
      },
      {
        h: "Is deductible financing legal in Texas?",
        p: [
          "Yes. Texas HB 2102 prohibits contractors from waiving, paying, absorbing, or rebating your deductible — but it does not prohibit financing it. As long as you pay your full deductible (over time, through a payment plan), you and the contractor are fully compliant.",
        ],
      },
      {
        h: "How PowerEdge helps",
        p: [
          "We document your storm damage, coordinate with your adjuster by the book, and can connect you with deductible financing so a tight month doesn't stand between you and a sound roof. You pay your full deductible — we never waive it.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can a roofer pay or waive my deductible in Texas?",
        a: "No — waiving, paying, absorbing, or rebating a deductible is illegal in Texas (HB 2102, a Class B misdemeanor). You must pay your full deductible. Financing it into payments is legal because you still pay it in full.",
      },
      {
        q: "Is financing my roof deductible legal?",
        a: "Yes. HB 2102 bans waiving the deductible, not financing it. A payment plan where you pay your full deductible over time is fully compliant.",
      },
      {
        q: "Do I need money down to finance my deductible?",
        a: "Often little or nothing down, depending on the program. You still pay your full deductible — just spread into monthly payments. Ask us about current options.",
      },
    ],
    cta: {
      heading: "Get your roof now — finance your deductible.",
      sub: "Free inspection, damage documented by the book, and financing options so your deductible isn't a roadblock.",
    },
  },
];

export function getGuide(slug: string) {
  return guides.find((g) => g.slug === slug);
}
