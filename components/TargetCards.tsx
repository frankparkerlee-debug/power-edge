"use client";

// Mobile knock cards with "Near me" GPS mode. Near-me queries the SERVER for
// everything within 15mi of the rep's position (the full target DB, not just
// the page's score-ranked subset) sorted by true distance — and says so
// plainly when nothing is close, including where the nearest cluster is.

import { useState } from "react";

export type TargetCard = {
  id: string;
  owner_name: string;
  address: string;
  city: string;
  zip: string;
  hail_size_in: number | null;
  solar: boolean;
  absentee: boolean;
  year_built: number | null;
  value: number | null;
  score: number;
  lat: number | null;
  lon: number | null;
};

type NearTarget = TargetCard & { distance_mi: number; storm_date?: string };

function fmtMi(mi: number) {
  if (mi < 0.19) return `${Math.round(mi * 5280)} ft`;
  return `${mi.toFixed(1)} mi`;
}

export function TargetCards({ targets }: { targets: TargetCard[] }) {
  const [locState, setLocState] = useState<"off" | "locating" | "on" | "denied" | "error">("off");
  const [nearTargets, setNearTargets] = useState<NearTarget[] | null>(null);
  const [emptyInfo, setEmptyInfo] = useState<{ city: string; mi: number } | null>(null);

  const reset = () => {
    setLocState("off");
    setNearTargets(null);
    setEmptyInfo(null);
  };

  const locate = () => {
    if (locState === "on") return reset();
    if (!navigator.geolocation) return setLocState("denied");
    setLocState("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const params = new URLSearchParams(window.location.search);
          const key = params.get("key") || "";
          const days = params.get("days") || "";
          const res = await fetch(
            `/api/admin/storm-targets?key=${encodeURIComponent(key)}&near=${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}${days ? `&days=${days}` : ""}`,
          );
          if (!res.ok) throw new Error(String(res.status));
          const data = await res.json();
          setNearTargets(data.targets ?? []);
          setEmptyInfo(data.nearest_beyond ?? null);
          setLocState("on");
        } catch {
          setLocState("error");
        }
      },
      () => setLocState("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const showing: Array<{ t: TargetCard; mi: number | null }> =
    locState === "on" && nearTargets
      ? nearTargets.map((t) => ({ t, mi: t.distance_mi }))
      : targets.map((t) => ({ t, mi: null }));

  return (
    <div className="mt-3 md:hidden">
      <button
        onClick={locate}
        className={`mb-2 w-full rounded-lg px-4 py-3 text-sm font-bold ${
          locState === "on"
            ? "bg-[#0b0e13] text-white"
            : "border-2 border-[#0c7a40] bg-white text-[#0c7a40]"
        }`}
      >
        {locState === "locating"
          ? "Finding doors near you…"
          : locState === "on"
            ? `📍 ${nearTargets?.length ?? 0} doors within 15 mi — tap to reset`
            : locState === "denied"
              ? "Location blocked — enable it in browser settings, then tap again"
              : locState === "error"
                ? "Couldn't load nearby doors — tap to retry"
                : "📍 Near me — show doors around where I'm standing"}
      </button>

      {locState === "on" && nearTargets && nearTargets.length === 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-bold">No storm targets within 15 miles of you.</p>
          <p className="mt-1 text-gray-700">
            {emptyInfo
              ? `Nearest cluster: ${emptyInfo.city}, about ${emptyInfo.mi} miles away.`
              : "No targets found in this region for the current filters."}
            {" "}Try widening the recency filter, or work inbound leads instead.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {showing.map(({ t, mi }) => (
          <div
            key={t.id}
            className={`rounded-lg border p-3 ${
              t.solar ? "border-green-300 bg-green-50" : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-semibold">{t.owner_name}</div>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(
                    `${t.address}, ${t.city || ""} TX ${t.zip || ""}`,
                  )}`}
                  target="_blank"
                  rel="noopener"
                  className="text-sm font-medium text-[#0c7a40] underline"
                >
                  {t.address}
                  {t.city ? `, ${t.city}` : ""} →
                </a>
              </div>
              <div className="shrink-0 text-right">
                {mi != null && (
                  <div className="mb-1 rounded-full bg-[#0c7a40] px-2.5 py-1 text-xs font-bold text-white">
                    {fmtMi(mi)}
                  </div>
                )}
                <span className="inline-block rounded-full bg-[#0b0e13] px-2.5 py-1 text-xs font-bold text-white">
                  {t.score}
                </span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {t.hail_size_in ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                  {t.hail_size_in}″ hail
                </span>
              ) : null}
              {t.solar && (
                <span className="rounded-full bg-green-200 px-2 py-0.5 font-semibold text-green-900">
                  ☀️ solar
                </span>
              )}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                {t.absentee ? "Absentee" : "Owner-occupied"}
              </span>
              {t.year_built ? (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                  built {t.year_built}
                </span>
              ) : null}
              {t.value ? (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                  ${Math.round(t.value / 1000)}k
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
