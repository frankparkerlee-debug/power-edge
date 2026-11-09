// Marketing depth for each service page, the "how it works" steps and the
// FAQ (which also powers FAQ rich-results via JSON-LD). Edit copy here; it
// renders on the matching /[service] page. Keyed by service slug.

export type Step = { title: string; desc: string };
export type Faq = { q: string; a: string };

type Content = {
  process: Step[];
  faqs: Faq[];
};

export const serviceContent: Record<string, Content> = {
  roofing: {
    process: [
      {
        title: "Free inspection",
        desc: "We get on your roof, photograph everything, and give you a straight assessment, no scare tactics, no pressure.",
      },
      {
        title: "Clear scope & quote",
        desc: "You get a written scope and price. For storm damage, we document the full claim for your adjuster.",
      },
      {
        title: "Fast, clean install",
        desc: "Our own crew handles tear-off and replacement, usually in a day or two, and leaves the site clean.",
      },
      {
        title: "Final walk & warranty",
        desc: "We walk the finished roof with you and back the work with a 1-year workmanship guarantee.",
      },
    ],
    faqs: [
      {
        q: "Do I need a licensed contractor for a roof in Texas?",
        a: "Texas doesn't license roofers, anyone can claim to be one, which is exactly the problem. PowerEdge is an insured, accountable company backed by $2,000,000 in liability coverage, so you're hiring an accountable business, not a fly-by-night crew.",
      },
      {
        q: "Will you help with my insurance claim?",
        a: "Yes. We document hail and storm damage with photos and measurements and work directly with your adjuster. By Texas law we can't waive your deductible or act as your public adjuster, and we won't, because following the law protects you.",
      },
      {
        q: "How fast can you replace my roof?",
        a: "Because the work is done by our own crews rather than subcontractors we chase, we can usually schedule within days, not weeks.",
      },
      {
        q: "How much does a new roof cost?",
        a: "It depends on size, pitch, material, and whether it's an insurance claim, which is why we inspect first and give you a firm written number instead of a guess over the phone.",
      },
      {
        q: "Do you do repairs, or only full replacements?",
        a: "Both. If a repair is the honest fix, we'll tell you, we don't push a replacement you don't need.",
      },
    ],
  },

  exterior: {
    process: [
      {
        title: "We inspect the whole exterior, not just the roof",
        desc: "The same free inspection. We photograph gutters, fascia, soffit, siding and fence along with the roof, because hail hits all of it and the soft metals are usually what dates the storm.",
      },
      {
        title: "Everything goes in one written assessment",
        desc: "Measurements and photographs for each item, in the same report. A claim that leaves off the fence and the gutters is a claim that pays for half the damage.",
      },
      {
        title: "You file; we meet your adjuster",
        desc: "We present what we documented across the whole exterior. What the policy covers stays between you and your carrier.",
      },
      {
        title: "One crew, one schedule",
        desc: "Roof, siding, gutters and fence handled by us rather than three subcontractors you have to chase. Finished and walked before we call it done.",
      },
    ],
    faqs: [
      {
        q: "Is fence damage really part of a hail claim?",
        a: "Often, yes. Most Texas homeowners policies cover fences under other structures, and hail that splinters pickets or dents metal is the same event that hit your roof. Whether it is covered is your carrier's call, but it should at least be documented, and plenty of claims get filed without it because nobody photographed it.",
      },
      {
        q: "Do you do siding and gutters without a roof job?",
        a: "Yes. If the roof is fine and the gutters are not, we will tell you that and quote just the gutters. We would rather do the small job honestly than invent a reason to sell you a roof.",
      },
      {
        q: "What kind of fencing do you do?",
        a: "Wood and metal fence repair and replacement, residential. We are not doing ornamental ironwork or custom gates.",
      },
      {
        q: "Is this a full home-improvement service?",
        a: "No, deliberately. Siding, fascia, soffit, gutters and fencing is the whole list. These are the trades that sit next to a storm-damaged roof, so our crews already work on them and our inspections already document them. Anything beyond that we would be learning on your house.",
      },
      {
        q: "How do you price it?",
        a: "On a covered claim, the carrier sets the scope and you pay your deductible, which we can finance at 0%. Outside a claim, a written quote after the free inspection. No pressure either way.",
      },
    ],
  },
  commercial: {
    process: [
      {
        title: "Walk the property",
        desc: "We assess your roof and put together a documented scope of work.",
      },
      {
        title: "Scheduled around you",
        desc: "Work is planned around your operating hours to minimize disruption to your business.",
      },
      {
        title: "One accountable crew",
        desc: "One contractor and one point of contact from start to finish, no coordinating separate subs.",
      },
      {
        title: "Documented & warrantied",
        desc: "You get photo documentation, code-compliant work, and a workmanship guarantee.",
      },
    ],
    faqs: [
      {
        q: "Do you work with property managers?",
        a: "Yes, property managers and business owners are core to what we do, with a single point of contact for all of your roofing needs.",
      },
      {
        q: "Do you offer emergency service?",
        a: "Yes, 24/7 emergency response for roofing failures.",
      },
      {
        q: "Can you service multiple locations?",
        a: "Yes. Tell us about your portfolio and we'll set up a plan and schedule that works across all your sites.",
      },
      {
        q: "Are you insured for commercial work?",
        a: "Yes, insured & accountable, backed by $2,000,000 in liability coverage.",
      },
    ],
  },
};

export function getServiceContent(slug: string): Content | undefined {
  return serviceContent[slug];
}
