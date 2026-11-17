// Cornerstone content for SEO + AI-answer-engine citation. Question-based
// headings with concise, extractable answers (what LLMs quote and what ranks).
// All facts grounded in verified research, no fabricated stats. Edit copy here.

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
  /** Shown on the page as "Updated"; defaults to datePublished. */
  dateModified?: string;
  /** Where the facts come from, listed on the page and in the Article schema. */
  sources?: { label: string; url: string }[];
};

export const guides: Guide[] = [
  {
    slug: "roof-replacement-cost-dallas-fort-worth",
    title: "How Much Does a Roof Replacement Cost in Dallas–Fort Worth? (2026)",
    h1: "How much does a roof replacement cost in Dallas–Fort Worth?",
    description:
      "A straight answer on DFW roof replacement cost in 2026, how roofing is priced by the square, what changes the price, and how to get an exact number from your address.",
    category: "Cost guide",
    datePublished: "2026-06-30",
    readMins: 5,
    intro:
      "Most roofers won't give you a number until a salesperson is in your living room. We'll just tell you how it works, and you can measure your own roof in seconds with our instant estimator.",
    sections: [
      {
        h: "What does a new roof cost in DFW?",
        p: [
          "Roofing is priced by the \"square\", one square equals 100 square feet of roof surface. In the Dallas–Fort Worth area, a quality architectural asphalt shingle roof installed typically runs about $400–$450 per square at PowerEdge, all-in.",
          "A typical single-story home has roughly 20–35 squares of roof once pitch and overhangs are counted, so most asphalt re-roofs land in a broad range, which is exactly why a real measurement matters more than a phone guess.",
        ],
      },
      {
        h: "What is a \"roofing square,\" and how many will my roof need?",
        p: [
          "A roofing square is 100 sq ft of actual roof surface, not floor space. Your roof area is larger than your home's footprint because of pitch (slope) and overhangs.",
          "Our instant estimator measures your roof's true surface area from satellite imagery, divides by 100 to get squares, adds about 10% for waste and cuts, and multiplies by our per-square rate. You get a ballpark in seconds, no sales call.",
        ],
      },
      {
        h: "What changes the price of a roof?",
        p: ["A few factors move the number up or down:"],
        bullets: [
          "Size, more squares, more cost (the biggest driver).",
          "Pitch, steeper roofs are slower and more dangerous to work, so they cost more.",
          "Material, architectural asphalt vs. premium designer shingles, metal, or tile.",
          "Tear-off, removing one or more existing layers and hauling them off.",
          "Decking, rotten or damaged decking under the shingles must be replaced.",
          "Access and complexity, valleys, dormers, steep multi-story sections, and tight access.",
        ],
      },
      {
        h: "Will insurance pay for my new roof?",
        p: [
          "Often, yes. If your roof was damaged by hail or wind, a Texas homeowners policy frequently covers the replacement, and you typically pay only your deductible, not the full retail price.",
          "The catch is timing and documentation. See our guide on Texas hail-damage insurance claims for the honest step-by-step, including the rules a legitimate contractor follows.",
        ],
      },
      {
        h: "How do I get an exact price?",
        p: [
          "An instant estimate gets you a ballpark; an exact price comes from a free on-site measurement where we confirm the roof, the decking, and the scope. There's no charge and no obligation, and if a repair is the honest fix instead of a replacement, we'll tell you.",
        ],
      },
    ],
    faqs: [
      {
        q: "How much is a new roof in Dallas–Fort Worth in 2026?",
        a: "Quality architectural asphalt shingle roofs at PowerEdge run about $400–$450 per roofing square installed. Total cost depends on your roof's size, pitch, material, and tear-off, measure yours instantly with our roof estimator for a real ballpark.",
      },
      {
        q: "What is a roofing square?",
        a: "A roofing square is 100 square feet of roof surface. Roofs are priced per square. Your roof has more squares than your home's floor area because of pitch and overhangs.",
      },
      {
        q: "Is a roof estimate from my address accurate?",
        a: "Our estimator measures your roof's surface area from satellite imagery, so the square count is accurate. The dollar range is a ballpark, your exact price is confirmed with a free on-site measurement.",
      },
    ],
    cta: {
      heading: "See your roof's cost in seconds.",
      sub: "Enter your address, we measure your roof from satellite imagery and give you an honest range on the spot.",
    },
  },

  {
    slug: "hail-damage-roof-insurance-claim-texas",
    title: "Hail Damage Roof Insurance Claims in Texas: An Honest Step-by-Step",
    h1: "Hail damage roof insurance claims in Texas: the honest guide",
    description:
      "How Texas roof insurance claims actually work after hail, RCV vs. actual-cash-value, the two-check process, deadlines, and the rules a legitimate contractor must follow.",
    category: "Insurance",
    datePublished: "2026-06-30",
    readMins: 6,
    intro:
      "A storm claim is where homeowners get burned by fly-by-night roofers. Here's how the process actually works in Texas, and how to spot a contractor who's breaking the law.",
    sections: [
      {
        h: "Do I even have a claim?",
        p: [
          "If hail or high wind has hit your area, your roof may have damage that's invisible from the ground, bruised, cracked, or fractured shingles that still let water in over time.",
          "Start by checking whether significant hail was reported near your address, then get a professional inspection to document it. Our free storm check pulls reported hail near your home straight from National Weather Service data.",
        ],
      },
      {
        h: "RCV vs. ACV: how Texas roof policies pay",
        p: [
          "Texas roof policies generally pay one of two ways. Replacement-cost value (RCV) pays up to the full current cost to replace your roof. Actual-cash-value (ACV) pays less, deducting for the roof's age and wear.",
          "Important: as roofs age, many insurers switch them from RCV to ACV, so an older roof may be worth far less on a claim than you expect. It's worth knowing which coverage you have before a storm, not after.",
        ],
      },
      {
        h: "How does the payout work? (The two-check process)",
        p: [
          "Under replacement-cost coverage, Texas insurers typically pay in two checks. The first is a partial payment based on the depreciated value; the balance (the \"recoverable depreciation\") is released after the work has begun and is verified.",
          "That means you don't get one lump sum up front, and a contractor who understands this will walk you through exactly what to expect.",
        ],
      },
      {
        h: "What a legitimate contractor legally CANNOT do",
        p: [
          "Texas law is strict here, and these rules protect you. A contractor who breaks them is a red flag:",
        ],
        bullets: [
          "They cannot offer to waive, rebate, or \"eat\" your insurance deductible, it's a crime in Texas (a Class B misdemeanor).",
          "They cannot act as your public insurance adjuster on a job they're also being paid to repair.",
          "They shouldn't pressure you to sign over your claim or sign a contract before you understand the scope.",
        ],
      },
      {
        h: "Is there a deadline to file?",
        p: [
          "Usually, yes. Texas policies set a window for filing a claim, some as short as one year from the date of loss, and once it closes, you pay for the roof yourself. Check your specific policy, and don't sit on suspected storm damage.",
        ],
      },
      {
        h: "How a claim works with PowerEdge",
        p: [
          "We document the damage with photos and measurements, work directly with your adjuster, and do it all by the book, no deductible games, no posing as your adjuster. Just an honest claim and a roof done right, backed by an insured, accountable contractor you can verify.",
        ],
      },
    ],
    faqs: [
      {
        q: "Will my Texas homeowners insurance pay for a hail-damaged roof?",
        a: "Often yes, if you have replacement-cost coverage and file a valid claim, you typically pay only your deductible. Aging roofs may be on actual-cash-value coverage, which pays less. An inspection documents whether you have a claim.",
      },
      {
        q: "Can a roofer waive my insurance deductible in Texas?",
        a: "No. It's illegal in Texas for a contractor to offer to waive, rebate, or absorb your deductible, it's a Class B misdemeanor. Any roofer who offers is breaking the law and putting you at risk.",
      },
      {
        q: "How long do I have to file a roof insurance claim in Texas?",
        a: "It depends on your policy, and some require filing within one year of the date of loss. Don't wait, check your policy and get the damage documented promptly.",
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
      "The honest answer: Texas does not license roofers, so anyone can call themselves one. Here's how to actually vet a roofer before you sign anything.",
    category: "Hiring guide",
    datePublished: "2026-06-30",
    readMins: 4,
    intro:
      "Short version: in Texas, the bar to call yourself a roofer is owning a ladder. Here's how to protect yourself, and what to actually check before you sign.",
    sections: [
      {
        h: "Does Texas license roofers?",
        p: [
          "No. Texas does not license or register roofers at the state level. There is no state roofing license to look up, and anyone can legally call themselves a roofer, no exam, no insurance requirement, nothing. That's exactly why storm-chasers flood the state after every hailstorm.",
        ],
      },
      {
        h: "So how do I actually vet a roofer?",
        p: ["Since the state won't vet them for you, do it yourself:"],
        bullets: [
          "Voluntary certification, look for RCAT (Roofing Contractors Association of Texas) certification, which requires passing exams.",
          "Local registration, some cities require roofers to register; ask.",
          "Insurance, confirm general liability and workers' comp, and get the certificate.",
          "A real local address and history, not just a magnet sign and an out-of-state phone number.",
          "Reviews and references, recent, specific, local reviews you can read.",
        ],
      },
      {
        h: "What CAN you actually verify in Texas?",
        p: [
          "Since there's no state roofer license to check, verify what you actually can: liability insurance (ask for the certificate directly, not just a claim), a real local address and business history, and recent, specific reviews you can read yourself, not a stranger's word on your doorstep.",
          "PowerEdge is an insured, accountable company backed by $2,000,000 in liability coverage, a 1-year workmanship guarantee, and a 4.7★ rating across 48 Google reviews, with a real local team behind every job, not a magnet sign on a truck.",
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
        a: "Roofing itself has no state license to check in Texas. What you can verify: liability insurance (ask for the certificate), a real local address and business history, and voluntary certifications like RCAT (Roofing Contractors Association of Texas).",
      },
      {
        q: "Is PowerEdge licensed?",
        a: "Texas doesn't license roofers, so there's no license to hold, PowerEdge is insured and accountable instead: $2,000,000 in liability coverage, a 1-year workmanship guarantee, and a 4.7★ rating across 48 Google reviews on every roofing job.",
      },
    ],
    cta: {
      heading: "Hire a crew you can actually verify.",
      sub: "Insured, accountable, and backed by real reviews. Get a free, no-pressure inspection.",
    },
  },

  {
    slug: "roof-deductible-financing-texas",
    title: "Can't Cover Your Roof Deductible? How Financing Works in Texas",
    h1: "How roof deductible financing works in Texas",
    description:
      "If a storm damaged your roof, you pay your deductible and insurance covers the rest, and you can finance that deductible into monthly payments. Here's how it works, and why it's legal.",
    category: "Insurance",
    datePublished: "2026-06-30",
    readMins: 4,
    intro:
      "A storm claim means you usually pay only your deductible. But if even that's tough to cover up front, you don't have to wait, here's how deductible financing lets you get your roof replaced now.",
    sections: [
      {
        h: "Do I have to pay my deductible?",
        p: [
          "Yes. By Texas law you must pay your full insurance deductible on a roof claim, there's no legal way around it. Any contractor who offers to \"waive,\" \"eat,\" or \"cover\" your deductible is breaking the law (HB 2102) and putting you at risk. We don't do that.",
        ],
      },
      {
        h: "What is deductible financing?",
        p: [
          "Deductible financing is simply a payment plan for your deductible. Instead of paying the whole amount up front, you spread it into smaller monthly payments, but you still pay it in full. It's financing, not waiving, which is exactly why it's legal and legitimate.",
        ],
      },
      {
        h: "Why finance my deductible?",
        p: [
          "Two reasons. First, timing: storm damage gets worse with every rain, and Texas claims have filing deadlines, financing lets you get the roof done now instead of waiting until you've saved the full deductible. Second, cash flow: a new roof for low monthly payments (often with little or nothing down) is easier on your budget than a lump sum.",
        ],
      },
      {
        h: "Is deductible financing legal in Texas?",
        p: [
          "Yes. Texas HB 2102 prohibits contractors from waiving, paying, absorbing, or rebating your deductible, but it does not prohibit financing it. As long as you pay your full deductible (over time, through a payment plan), you and the contractor are fully compliant.",
        ],
      },
      {
        h: "How PowerEdge helps",
        p: [
          "We document your storm damage, coordinate with your adjuster by the book, and can connect you with deductible financing so a tight month doesn't stand between you and a sound roof. You pay your full deductible, we never waive it.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can a roofer pay or waive my deductible in Texas?",
        a: "No, waiving, paying, absorbing, or rebating a deductible is illegal in Texas (HB 2102, a Class B misdemeanor). You must pay your full deductible. Financing it into payments is legal because you still pay it in full.",
      },
      {
        q: "Is financing my roof deductible legal?",
        a: "Yes. HB 2102 bans waiving the deductible, not financing it. A payment plan where you pay your full deductible over time is fully compliant.",
      },
      {
        q: "Do I need money down to finance my deductible?",
        a: "Often little or nothing down, depending on the program. You still pay your full deductible, just spread into monthly payments. Ask us about current options.",
      },
    ],
    cta: {
      heading: "Get your roof now, finance your deductible.",
      sub: "Free inspection, damage documented by the book, and financing options so your deductible isn't a roadblock.",
    },
  },
  {
    slug: "class-4-impact-resistant-shingles-texas",
    title: "Class 4 Impact-Resistant Shingles in Texas: Insurance Discounts and Whether They're Worth It",
    h1: "Are Class 4 impact-resistant shingles worth it in North Texas?",
    description:
      "What a Class 4 (UL 2218) shingle rating means, whether Texas insurers discount it, and how to decide if the upgrade is worth it on a Dallas–Fort Worth roof.",
    category: "Roof systems",
    datePublished: "2026-11-17",
    readMins: 5,
    intro:
      "If you're replacing a roof in Dallas–Fort Worth, someone will ask whether you want Class 4 shingles. Here's what the rating actually means, what it doesn't promise, and how to find out if your insurer will give you a discount for it.",
    sections: [
      {
        h: "What does Class 4 mean on a shingle?",
        p: [
          "Class 4 is the highest rating in UL 2218, the standard impact test for roofing. To earn it, a shingle is struck twice in about the same spot by a 2-inch steel ball dropped from 20 feet, and the back of the shingle can't show any tearing, cracking or opening.",
          "The lower classes use smaller balls from lower heights: Class 3 is a 1¾-inch ball from 17 feet, Class 2 a 1½-inch ball from 15 feet, and Class 1 a 1¼-inch ball from 12 feet. The test measures impact only. It doesn't measure how a shingle weathers or ages.",
        ],
      },
      {
        h: "Does a Class 4 roof lower your insurance in Texas?",
        p: [
          "It can, but it's your insurer's call. The Texas Department of Insurance says each company decides which discounts to offer and how much they're worth, and it lists an impact-resistant roof among the discounts a company may give.",
          "Some carriers want proof. The Texas Windstorm Insurance Association, for example, uses its own form (PC068) for a roof covering discount. Before you choose a shingle, call your agent and ask three things:",
        ],
        bullets: [
          "Do you give a discount for a UL 2218 Class 4 roof, and how much is it?",
          "What paperwork do you need from the roofer, and by when?",
          "Does the discount change my deductible or how a future hail claim is handled?",
        ],
      },
      {
        h: "Is Class 4 worth it in Dallas–Fort Worth?",
        p: [
          "North Texas is about as hail-prone as anywhere in the country. Texas led the nation in 2025 with 902 reports of hail an inch or larger, according to NOAA's Storm Prediction Center, and the National Weather Service in Fort Worth says large hail falls somewhere in the Metroplex nearly every year.",
          "Whether the upgrade pays for itself comes down to three numbers: what Class 4 adds to your roof price, what your insurer takes off your premium each year, and how long you'll stay in the house. If the discount covers the difference in a few years, it's an easy yes. If your insurer offers nothing, you're paying for a tougher roof in a place where hail is close to a yearly event. We'll quote standard and Class 4 side by side so you can do the math with real numbers.",
        ],
      },
      {
        h: "Does Class 4 mean hail can't damage the roof?",
        p: [
          "No. Class 4 is a lab test with a 2-inch steel ball. Larger or irregular hail can still damage any roof, and wind, age and poor installation still matter. What the rating buys you is a roof built to resist the impacts that ruin ordinary shingles. Our DFW hail reports show the sizes reported near you, storm by storm.",
        ],
      },
      {
        h: "Will insurance pay for a Class 4 upgrade after a hail claim?",
        p: [
          "Your policy decides that, not your roofer. Most homeowner policies pay to replace what you had with the same kind and quality, so the difference for an upgrade is usually yours to pay. Ask your insurer before the work starts. The upgrade never changes your deductible: you pay it in full either way, and Texas law makes waiving or rebating it an offense.",
        ],
      },
      {
        h: "Which impact-resistant shingles does PowerEdge install?",
        p: [
          "We install GAF and Owens Corning shingles, including Class 4 impact-resistant lines from both, on request. Ask at your free inspection and we'll put standard and Class 4 on the same written estimate.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is a Class 4 shingle?",
        a: "A shingle that passed UL 2218's toughest impact test: a 2-inch steel ball dropped from 20 feet onto the same spot twice, with no tearing, cracking or opening on the back of the shingle.",
      },
      {
        q: "Do Class 4 shingles lower homeowners insurance in Texas?",
        a: "It can. The Texas Department of Insurance says each insurer decides which discounts it offers and how much they are worth, and an impact-resistant roof is one of the discounts an insurer may give. Ask your agent for the amount and the paperwork they need before you pick a shingle.",
      },
      {
        q: "Does PowerEdge install Class 4 shingles?",
        a: "Yes, on request. We install GAF and Owens Corning shingles, including their Class 4 impact-resistant lines, and we'll price standard and Class 4 side by side on one written estimate.",
      },
    ],
    cta: {
      heading: "Price standard and Class 4 side by side.",
      sub: "A free inspection gets you both on one written estimate, and an honest answer about whether your roof needs replacing at all.",
    },
    sources: [
      { label: "Owens Corning: Class 4 impact-resistant shingles and the UL 2218 test", url: "https://www.owenscorning.com/roofing/tools/class-4-impact-resistant-roofing-shingles" },
      { label: "Malarkey Roofing: what UL 2218 Class 4 does and doesn't test", url: "https://www.malarkeyroofing.com/class-4-impact-resistance-roofing-shingles/" },
      { label: "Texas Department of Insurance: homeowners insurance guide (discounts)", url: "https://www.tdi.texas.gov/pubs/consumer/cb025.html" },
      { label: "Texas Department of Insurance: roofing discounts and TWIA form PC068", url: "https://tdi.texas.gov/company/roofing-discounts.html" },
      { label: "Insurance Information Institute: hail facts and statistics (NOAA SPC data)", url: "https://www.iii.org/fact-statistic/facts-statistics-hail" },
      { label: "National Weather Service Fort Worth: DFW severe weather climatology", url: "https://www.weather.gov/fwd/dfw_narrative" },
    ],
  },

  {
    slug: "best-roofing-material-for-hail-texas",
    title: "Best Roofing Material for Hail in North Texas (2026)",
    h1: "What's the best roofing material for hail in North Texas?",
    description:
      "Asphalt, Class 4 impact-resistant shingles, standing seam metal, tile: how each holds up to Dallas–Fort Worth hail, and how to choose.",
    category: "Roof systems",
    datePublished: "2026-11-17",
    readMins: 5,
    intro:
      "Every roofing material can be damaged by big enough hail. The question is which one gives you the best protection for the money in a place where hail comes almost every year. Here's how the common choices compare for a Dallas–Fort Worth home.",
    sections: [
      {
        h: "The short answer",
        p: [
          "For most DFW homes, the best value is an asphalt shingle roof with a Class 4 impact rating. It resists the hail that ruins ordinary shingles, crews and adjusters know it well, and some insurers discount it. Standing seam metal is tougher still, but it costs more and can dent. Tile and slate are heavy and can crack under large hail.",
        ],
      },
      {
        h: "How do the common roofing materials compare for hail?",
        p: ["What each one means for a North Texas roof:"],
        bullets: [
          "Architectural asphalt shingles: the most common roof in DFW and the lowest cost. Most carry a lower impact rating or none, so large hail can bruise or crack them.",
          "Class 4 impact-resistant asphalt shingles: passed UL 2218's 2-inch steel ball test. They cost more than standard shingles, and some Texas insurers offer a premium discount for them.",
          "Standing seam metal: very durable and long-lived, and many panels carry a Class 4 rating. Hail can still leave dents that don't leak, so ask your insurer how it treats cosmetic dents on a metal roof.",
          "Concrete tile, clay tile and slate: heavy and long-lasting, but rigid materials can crack under large hail. If you want one, ask for a product rated Class 4 under FM 4473, the impact test for rigid roofing.",
        ],
      },
      {
        h: "Why the rating matters more than the material name",
        p: [
          "Two shingles that look alike can perform very differently in hail. The impact class on the product's label tells you what it was tested to survive: UL 2218 for shingles and panels, FM 4473 for rigid materials like tile. When you compare quotes, compare the rated product, not just \"architectural shingle\" or \"metal.\"",
        ],
      },
      {
        h: "Does the rest of the roof system matter?",
        p: [
          "Yes. Underlayment, flashing, ventilation and the decking under the shingles decide whether a roof that takes a hit still keeps water out. A tough shingle on a poorly built system won't save you. Our guide to what goes into a roof system covers what to ask.",
        ],
      },
      {
        h: "What PowerEdge installs",
        p: [
          "On homes we install GAF and Owens Corning asphalt shingle roofs, with Class 4 impact-resistant lines from both on request. On commercial buildings we install standing seam metal and TPO flat roofs. Every inspection is free, and you get the verdict in writing, including when your roof is fine.",
        ],
      },
    ],
    faqs: [
      {
        q: "What roofing material holds up best to hail in Texas?",
        a: "Look for the impact rating, not just the material. A Class 4 (UL 2218) shingle or metal panel, or a Class 4 (FM 4473) tile, was tested to survive a 2-inch impact. For most Dallas–Fort Worth homes, Class 4 asphalt shingles are the best value.",
      },
      {
        q: "Is a metal roof better than shingles for hail?",
        a: "Metal resists punctures and lasts a long time, but hail can still dent it. Dents that don't leak may be treated as cosmetic by your insurer, so ask how your policy handles them before you choose metal.",
      },
      {
        q: "What roofs does PowerEdge install?",
        a: "GAF and Owens Corning asphalt shingle roofs on homes, with Class 4 impact-resistant shingles on request, and standing seam metal and TPO flat roofs on commercial buildings.",
      },
    ],
    cta: {
      heading: "Not sure what your roof should be?",
      sub: "A free inspection tells you what you have, what's damaged and what we'd recommend, in writing.",
    },
    sources: [
      { label: "Owens Corning: the UL 2218 impact test", url: "https://www.owenscorning.com/roofing/tools/class-4-impact-resistant-roofing-shingles" },
      { label: "FM Approvals: Standard 4473, impact resistance of rigid roofing", url: "https://www.fmapprovals.com/-/media/Feature/Approval-Standards/4473-pdf.pdf" },
      { label: "Texas Department of Insurance: homeowners insurance guide (discounts)", url: "https://www.tdi.texas.gov/pubs/consumer/cb025.html" },
      { label: "National Weather Service Fort Worth: DFW severe weather climatology", url: "https://www.weather.gov/fwd/dfw_narrative" },
    ],
  },

  {
    slug: "what-is-a-roof-system",
    title: "What Goes Into a Roof System (and What to Ask Your Roofer)",
    h1: "What goes into a roof system, and what should you ask your roofer?",
    description:
      "The parts of a modern roof system, from decking to ridge vent, what each one does, and the questions that separate a careful roofer from a fast one.",
    category: "Roof systems",
    datePublished: "2026-11-17",
    readMins: 5,
    intro:
      "Shingles are the part you see. Leaks often start in the parts you don't: flashing, valleys and pipe boots. Here is every layer of a modern shingle roof system, what it does, and what to ask before anyone tears off your roof.",
    sections: [
      {
        h: "What are the parts of a roof system?",
        p: ["From the bottom up:"],
        bullets: [
          "Decking: the plywood or OSB boards the whole roof is nailed to. Soft or rotten decking has to be replaced before anything goes on top.",
          "Underlayment: a water-resistant layer over the decking, the backup if water gets past the shingles.",
          "Ice and water barrier: a self-sealing membrane in the spots most likely to leak, such as valleys and around chimneys and pipes.",
          "Drip edge: metal trim along the edges that steers water into the gutters instead of behind the fascia.",
          "Starter strip: the first course at the eaves and rakes, which seals the bottom edge so wind can't lift it.",
          "Shingles: the weather surface, and the part with the impact rating.",
          "Hip and ridge caps: the shingles that cover the peaks.",
          "Ventilation: intake at the soffits and exhaust at or near the ridge, so the attic can breathe. Trapped heat shortens a roof's life.",
          "Flashing and pipe boots: metal and rubber pieces that seal where the roof meets walls, chimneys, vents and pipes.",
        ],
      },
      {
        h: "Why does ventilation matter so much in Texas?",
        p: [
          "A North Texas attic can get extremely hot in summer. Without balanced intake and exhaust, that heat cooks the shingles from underneath. Manufacturers take it seriously: GAF's warranty, for example, doesn't cover problems caused by inadequate ventilation. A good roofer looks at your attic, not just your shingles.",
        ],
      },
      {
        h: "What should you ask a roofer before they start?",
        p: ["These questions tell you how carefully a roof will be built:"],
        bullets: [
          "If you find soft decking, how is it replaced and how is it priced?",
          "What underlayment are you using, and where does ice and water barrier go?",
          "How is my attic ventilated now, and will intake and exhaust be balanced?",
          "Are you replacing the flashing and pipe boots, or reusing the old ones?",
          "Which shingle, and what is its impact rating?",
          "What warranty comes with the shingles, and what do you guarantee on the work, in writing?",
        ],
      },
      {
        h: "How PowerEdge writes it down",
        p: [
          "We install GAF and Owens Corning shingle roofs, with Class 4 impact-resistant shingles on request. Your written agreement lists the scope line by line before any work starts, so you can see exactly what is being replaced, and we put a 1-year workmanship guarantee in writing.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is included in a roof system?",
        a: "Decking, underlayment, ice and water barrier in valleys and around penetrations, drip edge, starter strip, shingles, hip and ridge caps, attic ventilation, and flashing and pipe boots. Leaks often start at flashing, valleys and pipe boots rather than in the shingles themselves.",
      },
      {
        q: "Does a new roof include new decking?",
        a: "Only where it's needed. Sound decking stays; soft or rotten boards are replaced before the new roof goes on. Ask your roofer how they'll handle and price it before work starts.",
      },
      {
        q: "Why does attic ventilation matter for a roof?",
        a: "Trapped attic heat ages shingles from underneath, and manufacturers such as GAF exclude problems caused by inadequate ventilation from their warranty. Balanced intake at the soffits and exhaust near the ridge protects the roof.",
      },
    ],
    cta: {
      heading: "See what's on your roof now.",
      sub: "A free inspection with photos of every part of the system, and a written verdict either way.",
    },
    sources: [
      { label: "GAF: residential roof warranty comparison (ventilation exclusion)", url: "https://www.gaf.com/en-us/resources/warranties/residential" },
    ],
  },

  {
    slug: "roof-warranty-manufacturer-vs-workmanship",
    title: "Roof Warranties Explained: Manufacturer vs. Workmanship (Texas Homeowner's Guide)",
    h1: "Roof warranties explained: manufacturer vs. workmanship",
    description:
      "What a shingle manufacturer's warranty covers, what a roofer's workmanship guarantee covers, how GAF and Owens Corning enhanced warranties work, and what to ask.",
    category: "Roof systems",
    datePublished: "2026-11-17",
    readMins: 5,
    intro:
      "Roof quotes throw around warranty years that sound alike and mean very different things. A new roof usually comes with two kinds of warranty, backed by two different companies. Here's what each one covers and what to get in writing.",
    sections: [
      {
        h: "What's the difference between a manufacturer and a workmanship warranty?",
        p: [
          "A manufacturer's warranty covers defects in the materials, and the shingle company backs it. A workmanship warranty covers how the roof was installed, and the roofer backs it. A well-made shingle still leaks if it's installed badly, so the workmanship side matters as much as the years printed on the shingle wrapper.",
        ],
      },
      {
        h: "What do standard manufacturer warranties cover?",
        p: [
          "Every shingle comes with the manufacturer's standard limited warranty, whoever installs it. Owens Corning's standard warranty, for example, includes a 10-year period where material defects are covered without proration, and it doesn't pay for tearing off the old roof. Read the exclusions: ventilation problems, for one, are commonly excluded.",
        ],
      },
      {
        h: "What are enhanced warranties like GAF Golden Pledge or Owens Corning Platinum?",
        p: [
          "Both companies sell longer system warranties, but only through contractors they've certified, and the warranty has to be registered.",
        ],
        bullets: [
          "GAF System Plus extends the non-prorated period from 10 to 50 years and adds tear-off and disposal. Any GAF Certified contractor can offer it.",
          "GAF Silver Pledge adds 10 years of coverage for installation errors (misapplication). It requires a Certified Plus or Master Elite contractor.",
          "GAF Golden Pledge adds 25 or 30 years of non-prorated misapplication coverage. It requires a Master Elite contractor.",
          "Owens Corning System Protection covers 50 years and tear-off but not workmanship. Preferred Protection adds 10 years of workmanship, and Platinum Protection adds limited lifetime workmanship. These require a Preferred or Platinum contractor.",
        ],
      },
      {
        h: "Does a warranty cover hail damage?",
        p: [
          "Storm damage is generally an insurance matter, not a warranty claim. A warranty covers defects in the product or the installation; hail is an outside event. Read your warranty's exclusions, and keep your insurance policy and your inspection reports together.",
        ],
      },
      {
        h: "What warranty comes with a PowerEdge roof?",
        p: [
          "Your GAF or Owens Corning shingles carry the manufacturer's standard limited warranty, and we put a 1-year workmanship guarantee in writing. We don't currently offer the manufacturers' enhanced system warranties, because those require a certification we don't hold yet. If one matters to you, ask any roofer which certification they hold and make sure the warranty is registered in your name.",
        ],
      },
      {
        h: "What should you get in writing?",
        p: ["Before you sign with anyone:"],
        bullets: [
          "Which manufacturer warranty applies, standard or enhanced, and who registers it.",
          "How long the roofer guarantees the work, and what it covers.",
          "Who you call if there's a leak, and how fast they come out.",
        ],
      },
    ],
    faqs: [
      {
        q: "What's the difference between a manufacturer warranty and a workmanship warranty?",
        a: "The shingle company backs the manufacturer warranty, which covers material defects. The roofer backs the workmanship warranty, which covers installation. A good shingle installed badly still leaks, so get the workmanship terms in writing.",
      },
      {
        q: "Who can offer GAF Golden Pledge or Owens Corning Platinum Protection?",
        a: "Only contractors the manufacturer has certified: GAF Master Elite for Golden Pledge, and Owens Corning Platinum contractors for Platinum Protection. The warranty must be registered to take effect.",
      },
      {
        q: "What warranty does PowerEdge give?",
        a: "The shingle manufacturer's standard limited warranty on GAF or Owens Corning shingles, plus PowerEdge's 1-year workmanship guarantee in writing.",
      },
    ],
    cta: {
      heading: "Questions about your roof's warranty?",
      sub: "Bring them to a free inspection. You'll get a written verdict on your roof, and straight answers on what's covered.",
    },
    sources: [
      { label: "GAF: residential roof warranty comparison guide", url: "https://www.gaf.com/en-us/resources/warranties/residential" },
      { label: "Owens Corning: roofing warranties", url: "https://www.owenscorning.com/en-us/roofing/warranty" },
    ],
  },

];

export function getGuide(slug: string) {
  return guides.find((g) => g.slug === slug);
}
