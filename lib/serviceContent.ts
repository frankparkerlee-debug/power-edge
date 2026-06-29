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
        a: "Texas doesn't license roofers — anyone can claim to be one, which is exactly the problem. PowerEdge is a licensed electrical contractor (TECL #39773), so you can actually verify who you're hiring on the state TDLR portal.",
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

  electrical: {
    process: [
      {
        title: "Book a service call",
        desc: "Call or request online and we get a licensed electrician scheduled fast — often the same day.",
      },
      {
        title: "Diagnose & quote",
        desc: "We find the actual problem and give you a written, flat-rate price before any work starts.",
      },
      {
        title: "Fix it right",
        desc: "Work is done to code under our Master Electrician's license — permitted and inspection-ready where required.",
      },
      {
        title: "Verify & guarantee",
        desc: "We test the work, clean up, and back it with our workmanship guarantee.",
      },
    ],
    faqs: [
      {
        q: "Are your electricians licensed?",
        a: "Yes. All work runs under John Lott's 40-year Master Electrician license (TECL #39773) — which you can verify for free on the Texas TDLR portal.",
      },
      {
        q: "Do you charge for an estimate?",
        a: "Service calls carry a flat $89 diagnostic fee, waived if you book the repair the same visit. Larger jobs like panel upgrades get a free on-site quote.",
      },
      {
        q: "How much is a panel upgrade?",
        a: "A like-for-like panel swap starts around $1,850, and a 100A-to-200A service upgrade around $2,650 with permit included. You get a firm price after a free assessment.",
      },
      {
        q: "Can you install an EV charger?",
        a: "Yes. A dedicated 240V Level 2 charger circuit starts around $695, depending on the run length and your panel's capacity.",
      },
      {
        q: "Do you offer same-day service?",
        a: "For most service and repair calls, yes — a dead outlet or a tripping breaker isn't something you should have to wait days for.",
      },
    ],
  },

  solar: {
    process: [
      {
        title: "Tell us the symptom",
        desc: "Panels not producing, an inverter error, or storm damage — describe it and we'll get out to look.",
      },
      {
        title: "Licensed diagnosis",
        desc: "A licensed electrician assesses the system — Texas law requires solar electrical work to run under a Master Electrician.",
      },
      {
        title: "Repair or replace",
        desc: "We repair what's fixable and replace what isn't, including re-energizing your system during a roof replacement.",
      },
      {
        title: "Test & confirm",
        desc: "We confirm the system is producing and safe before we leave.",
      },
    ],
    faqs: [
      {
        q: "Do you install new solar systems?",
        a: "No — we focus on repair and replacement of existing systems. That means no sales pitch, just the fix.",
      },
      {
        q: "Why does solar repair require an electrical license?",
        a: "Solar is electrical work. Texas law — tightened in 2025 — requires it to be performed under a licensed electrical contractor. That's us: TECL #39773.",
      },
      {
        q: "My roof is being replaced — can you handle the panels?",
        a: "Yes. We can disconnect, protect, and re-energize your solar system around a roof replacement, all under one roof.",
      },
      {
        q: "Can you fix panels after hail or wind damage?",
        a: "Yes — we replace damaged panels and repair affected wiring and inverters, and can document it for an insurance claim.",
      },
      {
        q: "Do you service any brand of system?",
        a: "We service most common residential systems. Tell us your equipment and we'll confirm before we come out.",
      },
    ],
  },

  commercial: {
    process: [
      {
        title: "Walk the property",
        desc: "We assess your roof, your electrical, or both, and put together a documented scope of work.",
      },
      {
        title: "Scheduled around you",
        desc: "Work is planned around your operating hours to minimize disruption to your business.",
      },
      {
        title: "One accountable team",
        desc: "One contractor and one point of contact for both trades — no coordinating separate subs.",
      },
      {
        title: "Documented & warrantied",
        desc: "You get photo documentation, code-compliant work, and a workmanship guarantee.",
      },
    ],
    faqs: [
      {
        q: "Do you work with property managers?",
        a: "Yes — property managers and business owners are core to what we do, with a single point of contact across roofing and electrical.",
      },
      {
        q: "Can you handle both roofing and electrical?",
        a: "That's the whole point. One licensed team covers both trades, so there's no finger-pointing when a roof penetration meets your wiring.",
      },
      {
        q: "Do you offer emergency service?",
        a: "Yes — 24/7 emergency response for electrical and roofing failures.",
      },
      {
        q: "Can you service multiple locations?",
        a: "Yes. Tell us about your portfolio and we'll set up a plan and schedule that works across all your sites.",
      },
      {
        q: "Are you licensed and insured for commercial work?",
        a: "Yes — Texas electrical contractor license TECL #39773, backed by $2,000,000 in liability coverage.",
      },
    ],
  },
};

export function getServiceContent(slug: string): Content | undefined {
  return serviceContent[slug];
}
