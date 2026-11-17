import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { site } from "@/lib/site";
import { CopyText } from "@/components/CopyText";
import { PAGE_MIN_IN, daysAgo, niceDay, serviceAreaHail, stoneSize, stormDays } from "@/lib/hailHistory";

/**
 * Storm posts: a ready-to-paste Google Business Profile post and Nextdoor
 * post for each recent storm day with claim-size hail, each linking to that
 * day's public hail page. Posting the day after a storm is the cheapest
 * inbound there is; this takes the writing out of it.
 *
 * Wording rules (same as the site): hail was "reported", we never say it hit
 * a home, never offer claim handling, never mention covering a deductible.
 */
export const metadata: Metadata = { title: "Storm posts", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const DAYS_BACK = 45;

function list(xs: string[]) {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

export default async function StormPostsPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  const user = await currentUser(key);
  if (!user || user.role !== "admin") {
    return (
      <div className="px-4 py-8 text-[#0b0e13]">
        <h1 className="font-display text-2xl font-extrabold">Storm posts</h1>
        <p className="mt-2 text-sm text-gray-600">
          For the office. <Link href="/login" className="font-semibold text-[#0c7a40] underline">Sign in</Link> as an admin.
        </p>
      </div>
    );
  }

  const since = daysAgo(DAYS_BACK);
  const days = stormDays(await serviceAreaHail(since)).filter((d) => d.maxIn >= PAGE_MIN_IN);

  return (
    <div className="px-4 py-6 text-[#0b0e13] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold">Storm posts</h1>
        <p className="mt-1 text-sm text-gray-600">
          Post the day after a storm. In Google Business Profile, choose Add update, paste the post, add a Learn more button
          and paste the link. On Nextdoor, post from the PowerEdge business page. Days with hail 1 inch or larger in the last{" "}
          {DAYS_BACK} days.
        </p>

        {days.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">
            No hail an inch or larger reported in our counties in the last {DAYS_BACK} days. When there is, the posts show up
            here on their own.
          </div>
        ) : (
          <div className="mt-6 space-y-10">
            {days.map((d) => {
              const towns = d.towns.slice(0, 4);
              const link = (src: string) =>
                `${site.url}/hail-reports/${d.date}?utm_source=${src}&utm_medium=organic&utm_campaign=storm-${d.date}`;
              const where = list(towns);
              // "near X" only adds something when more than one town reported hail.
              const nearBiggest = towns.length > 1 && d.biggestTown ? ` near ${d.biggestTown}` : "";
              // Google posts don't make links in the text clickable: the link
              // goes in the post's "Learn more" button instead.
              const gbp =
                `Hail was reported around ${where} on ${niceDay(d.date, false)}, up to ${stoneSize(d.maxIn)}` +
                `${nearBiggest}, according to the National Weather Service.\n\n` +
                `Tap Learn more to see every report from that day and check your own address, free.\n\n` +
                `If you want someone to look, our inspection is free and you get a written verdict with photos, including when your roof is fine.`;
              const nextdoor =
                `For anyone wondering about the storm on ${niceDay(d.date, false)}: the National Weather Service logged ` +
                `${d.reports} hail report${d.reports === 1 ? "" : "s"} around ${where}, the largest ${stoneSize(d.maxIn)}` +
                `${nearBiggest}.\n\n` +
                `The full list is here: ${link("nextdoor")}\n\n` +
                `Things you can check from the ground: dented gutters and roof vents, dents on the A/C fins, and shingle granules ` +
                `collecting at the downspouts. Please stay off the roof.\n\n` +
                `If you'd like a second opinion, our inspections are free and you get the verdict in writing either way.`;
              return (
                <section key={d.date}>
                  <h2 className="font-display text-lg font-bold">
                    {niceDay(d.date)} · up to {d.maxIn}″ · {d.counties.join(", ")}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {d.reports} report{d.reports === 1 ? "" : "s"} ·{" "}
                    <Link href={`/hail-reports/${d.date}`} className="underline">
                      the public page
                    </Link>
                  </p>
                  <div className="mt-3 space-y-3">
                    <CopyText label="Google Business Profile post" text={gbp} />
                    <CopyText label="Google: Learn more button link" text={link("gbp")} />
                    <CopyText label="Nextdoor (business page)" text={nextdoor} />
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
