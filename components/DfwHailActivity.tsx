"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container, Kicker } from "./ui";
import { CountUp } from "./CountUp";

/**
 * Live "storm intelligence" band — real DFW-wide hail activity (NWS/IEM, last 12
 * months) via /api/dfw-hail. Dynamic, proprietary-feeling proof that funnels
 * into the per-address claim check. Degrades gracefully if the feed is empty.
 */

type Data = {
  ok: boolean;
  scope?: "local" | "metro";
  city?: string | null;
  radiusMi?: number;
  count: number;
  largest?: number;
  topCities: { city: string; count: number }[];
  recent: { city: string; size: number; date: string }[];
};

function fmt(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function DfwHailActivity() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/dfw-hail")
      .then((r) => r.json())
      .then((d) => live && setData(d))
      .catch(() => live && setData({ ok: false, count: 0, topCities: [], recent: [] }));
    return () => {
      live = false;
    };
  }, []);

  const hasData = !!data && data.ok && data.count > 0;
  const near = hasData && data!.scope === "local" && !!data!.city;

  return (
    <section className="relative overflow-hidden bg-ink py-20 sm:py-28">
      <div className="absolute inset-0 grid-texture opacity-60" />
      <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-ember/10 blur-[120px]" />
      <Container className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <Kicker className="mb-5">Live storm intelligence · DFW</Kicker>
          {hasData ? (
            <>
              <h2 className="font-display text-4xl font-extrabold leading-[1.05] text-fg-inv sm:text-5xl">
                <CountUp to={data!.count} className="text-bolt" duration={1600} />+
                <br />
                hail reports {near ? `near ${data!.city}` : "across Dallas–Fort Worth"}
              </h2>
              {near && (
                <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-fg-inv-dim">
                  {data!.city} · Dallas–Fort Worth · last 12 months
                </p>
              )}
              <p className="mt-4 max-w-md text-fg-inv-dim">
                Reported to the National Weather Service in the last 12 months
                {near ? ` within ~${data!.radiusMi} miles of you` : ""}
                {data!.largest
                  ? ` — the largest ${data!.largest}″${near ? " nearby" : " across the metro"}`
                  : ""}
                . Damage is easy to miss from the ground, and Texas claims have
                deadlines.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-4xl font-extrabold leading-[1.05] text-fg-inv sm:text-5xl">
                DFW is the #1 hail metro
                <br />
                in the country.
              </h2>
              <p className="mt-4 max-w-md text-fg-inv-dim">
                North Texas gets hammered every season — and hail damage is easy
                to miss from the ground. Check your exact address against
                reported storm activity, free.
              </p>
            </>
          )}
          <div className="mt-7">
            <Link
              href="/roof-claim-check"
              className="inline-block rounded-md bg-bolt px-6 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-bolt-hi"
            >
              Is your roof one of them? Check your address →
            </Link>
          </div>
          <p className="mt-3 text-xs text-fg-inv-dim">
            Source: NWS / NOAA Local Storm Reports (Fort Worth/Dallas office).
          </p>
        </div>

        {/* Hardest-hit cities + recent events */}
        <div className="rounded-card border border-line bg-ink-2 p-7 shadow-xl">
          {!data ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-40 rounded bg-line" />
              <div className="h-10 w-full rounded bg-line" />
              <div className="h-10 w-full rounded bg-line" />
            </div>
          ) : hasData ? (
            <>
              <div className="text-xs font-bold uppercase tracking-wider text-fg-inv-dim">
                {near ? "Hardest-hit areas near you (12 mo)" : "Hardest-hit areas (12 mo)"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.topCities.map((c) => (
                  <span
                    key={c.city}
                    className="rounded-full border border-line bg-ink px-3 py-1.5 text-sm text-fg-inv"
                  >
                    {c.city}{" "}
                    <span className="font-bold text-bolt">{c.count}</span>
                  </span>
                ))}
              </div>
              <div className="mt-6 text-xs font-bold uppercase tracking-wider text-fg-inv-dim">
                Most recent
              </div>
              <ul className="mt-3 divide-y divide-line">
                {data.recent.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <span className="text-fg-inv">{e.city || "DFW area"}</span>
                    <span className="text-fg-inv-dim">
                      <span className="font-semibold text-fg-inv">
                        {e.size}″
                      </span>{" "}
                      · {fmt(e.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="text-center">
              <div className="font-display text-5xl font-extrabold text-bolt">
                #1
              </div>
              <p className="mt-2 text-sm text-fg-inv-dim">
                Dallas County leads the U.S. in hail-damage losses. If a storm
                came through, your roof may already qualify — check free.
              </p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
