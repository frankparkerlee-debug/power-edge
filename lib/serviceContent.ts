// Marketing depth for each service page — the "how it works" steps and the
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
        desc: "We get on your roof, photograph everything, and give you a straight assessment — no scare tactics, no pressure.",
      },
      {
        title: "Clear scope & quote",
        desc: "You get a written scope and price. For storm damage, we document the full claim for your adjuster.",
      },
      {
        title: "Fast, clean install",
        desc: "One of our four crews handles tear-off and replacement — usually in a day or two — and leaves the site clean.",
      },
      {
        title: "Final walk & warranty",
        desc: "We walk the finished roof with you and back the work with a 1-year workmanship guarantee.",
      },
    ],
    faqs: [
      {
        q: "Do I need a licensed contractor for a roof in Texas?",
        a: "Texas doesn't license roofers — anyone can claim to be one, which is exactly the problem. PowerEdge is a licensed, insured company backed by $2,000,000 in liability coverage, so you're hiring an accountable business, not a fly-by-night crew.",
      },
      {
        q: "Will you help with my insurance claim?",
        a: "Yes. We document hail and storm damage with photos and measurements and work directly with your adjuster. By Texas law we can't waive your deductible or act as your public adjuster — and we won't, because following the law protects you.",
      },
      {
        q: "How fast can you replace my roof?",
        a: "With four crews and capacity for around 100 roofs a month, we can usually schedule within days, not weeks.",
      },
      {
        q: "How much does a new roof cost?",
        a: "It depends on size, pitch, material, and whether it's an insurance claim — which is why we inspect first and give you a firm written number instead of a guess over the phone.",
      },
      {
        q: "Do you do repairs, or only full replacements?",
        a: "Both. If a repair is the honest fix, we'll tell you — we don't push a replacement you don't need.",
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
        desc: "One contractor and one point of contact from start to finish — no coordinating separate subs.",
      },
      {
        title: "Documented & warrantied",
        desc: "You get photo documentation, code-compliant work, and a workmanship guarantee.",
      },
    ],
    faqs: [
      {
        q: "Do you work with property managers?",
        a: "Yes — property managers and business owners are core to what we do, with a single point of contact for all of your roofing needs.",
      },
      {
        q: "Do you offer emergency service?",
        a: "Yes — 24/7 emergency response for roofing failures.",
      },
      {
        q: "Can you service multiple locations?",
        a: "Yes. Tell us about your portfolio and we'll set up a plan and schedule that works across all your sites.",
      },
      {
        q: "Are you licensed and insured for commercial work?",
        a: "Yes — licensed & insured, backed by $2,000,000 in liability coverage.",
      },
    ],
  },
};

export function getServiceContent(slug: string): Content | undefined {
  return serviceContent[slug];
}
