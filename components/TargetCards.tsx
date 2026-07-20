"use client";

// Mobile knock cards with "Near me" GPS mode: sorts targets by distance from
// the rep's current position and shows how far each door is. Falls back to
// score order when location is off/denied.

import { useMemo, useState } from "react";

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

function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtMi(mi: number) {
  if (mi < 0.19) return `${Math.round(mi * 5280)} ft`;
  return `${mi.toFixed(1)} mi`;
}

export function TargetCards({ targets }: { targets: TargetCard[] }) {
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const [locState, setLocState] = useState<"off" | "locating" | "on" | "denied">("off");

  const locate = () => {
    if (locState === "on") {
      setMe(null);
      setLocState("off");
      return;
    }
    if (!navigator.geolocation) {
      setLocState("denied");
      return;
    }
    setLocState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocState("on");
      },
      () => setLocState("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const sorted = useMemo(() => {
    if (!me) return targets.map((t) => ({ t, mi: null as number | null }));
    return targets
      .map((t) => ({
        t,
        mi: t.lat != null && t.lon != null ? haversineMi(me.lat, me.lon, t.lat, t.lon) : null,
      }))
      .sort((a, b) => (a.mi ?? 1e9) - (b.mi ?? 1e9));
  }, [targets, me]);

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
          ? "Locating…"
          : locState === "on"
            ? "📍 Sorted by distance from you — tap to reset"
            : locState === "denied"
              ? "Location blocked — enable it in browser settings"
              : "📍 Near me — sort doors by where I'm standing"}
      </button>

      <div className="space-y-2">
        {sorted.map(({ t, mi }) => (
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
