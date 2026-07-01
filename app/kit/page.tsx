import type { Metadata } from "next";
import QRCode from "qrcode";
import { site } from "@/lib/site";

// Internal door-knock QR kit — NOT indexed. Generates QR codes that point to
// the tools with UTM attribution so leads from door-knocking (and per-rep) are
// tracked. Add ?rep=Name to tag a specific knocker.
export const metadata: Metadata = {
  title: "Door-Knock QR Kit",
  robots: { index: false, follow: false },
};

type Card = {
  label: string;
  pitch: string;
  path: string;
  campaign: string;
};

const CARDS: Card[] = [
  {
    label: "Free Roof Claim Check",
    pitch: "“Scan to see if YOUR roof likely qualifies for a claim — free, 60 seconds.”",
    path: "/roof-claim-check",
    campaign: "claim",
  },
  {
    label: "Deductible Financing",
    pitch: "“Scan to see your deductible financed — $0 down, low monthly.”",
    path: "/financing",
    campaign: "financing",
  },
  {
    label: "PowerEdge Home",
    pitch: "“Scan to see who we are — licensed, verifiable, local.”",
    path: "/",
    campaign: "home",
  },
];

function trackedUrl(path: string, campaign: string, rep?: string) {
  const u = new URL(path, site.url);
  u.searchParams.set("utm_source", "doorhanger");
  u.searchParams.set("utm_medium", "qr");
  u.searchParams.set("utm_campaign", campaign);
  if (rep) u.searchParams.set("utm_content", rep);
  return u.toString();
}

export default async function KitPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string }>;
}) {
  const { rep } = await searchParams;
  const repClean = (rep || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);

  const cards = await Promise.all(
    CARDS.map(async (c) => {
      const url = trackedUrl(c.path, c.campaign, repClean || undefined);
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        width: 320,
        color: { dark: "#0b0e13", light: "#ffffff" },
      });
      return { ...c, url, svg };
    }),
  );

  return (
    <div className="min-h-screen bg-white px-6 py-10 text-[#0b0e13]">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-end justify-between border-b border-gray-200 pb-5">
          <div>
            <h1 className="font-display text-3xl font-extrabold">
              PowerEdge — Door-Knock QR Kit
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Print this, or save each QR to drop into your door hangers.
              {repClean ? (
                <> Tagged to rep: <strong>{repClean}</strong>.</>
              ) : (
                <>
                  {" "}
                  Add <code className="rounded bg-gray-100 px-1">?rep=Name</code>{" "}
                  to this page&apos;s URL to tag a specific rep.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.campaign}
              className="flex flex-col items-center rounded-xl border border-gray-200 p-6 text-center"
            >
              <h2 className="font-display text-lg font-bold">{c.label}</h2>
              <p className="mt-1 h-10 text-sm text-gray-600">{c.pitch}</p>
              <div
                className="mt-3 h-[220px] w-[220px]"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: c.svg }}
              />
              <p className="mt-3 break-all text-[10px] text-gray-400">{c.url}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl bg-gray-50 p-6 text-sm text-gray-700">
          <p className="font-bold">How tracking works</p>
          <p className="mt-1">
            Every scan opens the tool with attribution built in, so leads from
            door-knocking show up tagged <strong>source: doorhanger</strong> in
            your lead emails{repClean ? "" : " (and per-rep when you add ?rep=)"}.
            Give each rep their own link — e.g.{" "}
            <code className="rounded bg-gray-100 px-1">
              {site.url}/kit?rep=mike
            </code>{" "}
            — to print rep-specific QR codes and see who&apos;s driving leads.
          </p>
        </div>
      </div>
    </div>
  );
}
