// Rich storm-report visuals shown after an address check. All derived from the
// free NWS data /api/storm-check already returns — no extra APIs.

type MapPt = { size: number; miles: number; bearing: number };
type Event = {
  size: number;
  date: string;
  city: string;
  county: string;
  miles: number;
  bearing: number;
};

export type StormData = {
  matched?: string | null;
  approximate?: boolean;
  radiusMi?: number;
  count?: number;
  significantCount?: number;
  largest?: { size: number; date: string; city: string; miles: number } | null;
  mostRecent?: { size: number; date: string } | null;
  recent?: Event[];
  map?: MapPt[];
};

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function cardinal(b: number) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
    Math.round(b / 45) % 8
  ];
}

function monthsAgo(iso: string) {
  if (!iso) return Infinity;
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  return days / 30.44;
}

function damageTier(size: number) {
  if (size >= 2)
    return {
      label: "Severe damage likely",
      tone: "var(--color-ember)",
      note: "Hail this size routinely cracks shingles, dents metal, and totals roofs.",
    };
  if (size >= 1.5)
    return {
      label: "Damage likely",
      tone: "var(--color-ember)",
      note: "Golf-ball-plus hail commonly bruises and fractures asphalt shingles.",
    };
  if (size >= 1)
    return {
      label: "Damage possible",
      tone: "var(--color-bolt)",
      note: "Quarter-to-golf-ball hail can bruise shingles — damage is often invisible from the ground.",
    };
  return {
    label: "Lower risk",
    tone: "var(--color-bolt)",
    note: "Smaller hail less commonly damages shingles, but it's still worth a look.",
  };
}

function dotColor(size: number) {
  if (size >= 1.5) return "var(--color-ember)";
  if (size >= 1) return "var(--color-bolt)";
  return "#6b7280";
}

const REFS = [
  { in: 1, label: "Quarter" },
  { in: 1.75, label: "Golf ball" },
  { in: 2.5, label: "Tennis ball" },
  { in: 2.75, label: "Baseball" },
];

/** Concentric-ring scatter of where hail hit around the address. */
function ProximityMap({ pts, radiusMi }: { pts: MapPt[]; radiusMi: number }) {
  const C = 120;
  const R = 100;
  const ringMi = [5, 10, 15].filter((m) => m <= radiusMi);
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full" role="img" aria-label="Map of hail reports near your address">
      {ringMi.map((m) => (
        <circle
          key={m}
          cx={C}
          cy={C}
          r={(m / radiusMi) * R}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth="1"
        />
      ))}
      {ringMi.map((m) => (
        <text
          key={`l${m}`}
          x={C + 3}
          y={C - (m / radiusMi) * R + 11}
          fill="#5b6472"
          fontSize="8"
        >
          {m}mi
        </text>
      ))}
      {pts.map((p, i) => {
        const r = Math.min(p.miles / radiusMi, 1) * R;
        const rad = (p.bearing * Math.PI) / 180;
        const x = C + r * Math.sin(rad);
        const y = C - r * Math.cos(rad);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={p.size >= 1.5 ? 4 : p.size >= 1 ? 3 : 2}
            fill={dotColor(p.size)}
            opacity="0.85"
          />
        );
      })}
      {/* home */}
      <circle cx={C} cy={C} r="5" fill="var(--color-fg-inv)" />
      <circle cx={C} cy={C} r="9" fill="none" stroke="var(--color-fg-inv)" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

/** Horizontal hail-size scale with familiar reference objects. */
function HailScale({ size }: { size: number }) {
  const max = Math.max(3, Math.ceil(size * 2) / 2);
  const pct = (v: number) => `${Math.min(v / max, 1) * 100}%`;
  return (
    <div className="pt-6">
      <div className="relative h-2 rounded-full bg-line">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-bolt"
          style={{ width: pct(size) }}
        />
        {/* largest marker */}
        <div
          className="absolute -top-1.5 h-5 w-1 -translate-x-1/2 rounded bg-fg-inv"
          style={{ left: pct(size) }}
        />
      </div>
      <div className="relative mt-2 h-8">
        {REFS.filter((r) => r.in <= max).map((r) => (
          <div
            key={r.label}
            className="absolute -translate-x-1/2 text-center"
            style={{ left: pct(r.in) }}
          >
            <div className="mx-auto h-2 w-px bg-line" />
            <div className="mt-0.5 whitespace-nowrap text-[10px] text-fg-inv-dim">
              {r.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StormReport({ data }: { data: StormData }) {
  const radiusMi = data.radiusMi ?? 15;
  const largestSize = data.largest?.size ?? 0;
  const tier = damageTier(largestSize);
  const pts = data.map ?? [];

  // Claim-window urgency: most recent significant (1"+) storm within a year.
  const sigRecent = (data.recent ?? []).find(
    (e) => e.size >= 1 && monthsAgo(e.date) <= 12,
  );

  return (
    <div>
      <div
        className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
        style={{ color: tier.tone, border: `1px solid ${tier.tone}` }}
      >
        Hail reported near you
      </div>
      <h2 className="font-display text-2xl font-bold leading-tight text-fg-inv sm:text-3xl">
        {data.count} hail event{data.count === 1 ? "" : "s"} reported within{" "}
        {radiusMi} miles.
      </h2>
      {data.matched && (
        <p className="mt-2 text-sm text-fg-inv-dim">
          {data.approximate ? "Near " : ""}
          {data.matched}
        </p>
      )}

      {/* Map + headline stats */}
      <div className="mt-5 grid gap-4 sm:grid-cols-[150px_1fr] sm:items-center">
        <div className="mx-auto h-[150px] w-[150px] rounded-card border border-line bg-ink p-2">
          {pts.length > 0 ? (
            <ProximityMap pts={pts} radiusMi={radiusMi} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-fg-inv-dim">
              map
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat big={`${largestSize}"`} small={`Largest hail · ${fmtDate(data.largest?.date || "")}`} />
          <Stat big={`${data.significantCount ?? 0}`} small={'Events 1" or larger'} />
          <Stat big={fmtDate(data.mostRecent?.date || "")} small="Most recent report" />
          <Stat big={`${data.count}`} small={`Total within ${radiusMi} mi`} />
        </div>
      </div>

      {/* Damage interpretation + size scale */}
      <div className="mt-5 rounded-card border border-line bg-ink p-5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: tier.tone }} />
          <span className="font-display font-bold" style={{ color: tier.tone }}>
            {tier.label}
          </span>
          <span className="text-sm text-fg-inv-dim">
            — largest reported hail was {largestSize}&quot;
          </span>
        </div>
        <p className="mt-1.5 text-sm text-fg-inv-dim">{tier.note}</p>
        <HailScale size={largestSize} />
      </div>

      {/* Claim-window urgency */}
      {sigRecent && (
        <div className="mt-4 rounded-card border border-ember/50 bg-ember/10 p-4">
          <p className="text-sm text-fg-inv">
            <strong className="text-ember">Don&apos;t wait:</strong> a{" "}
            {sigRecent.size}&quot; hail event hit ~{Math.round(monthsAgo(sigRecent.date))}{" "}
            month{Math.round(monthsAgo(sigRecent.date)) === 1 ? "" : "s"} ago
            ({fmtDate(sigRecent.date)}). Many Texas policies require filing a hail
            claim within a year of the date of loss — once that window closes, you
            pay for the roof yourself.
          </p>
        </div>
      )}

      {/* Recent timeline */}
      {(data.recent?.length ?? 0) > 0 && (
        <div className="mt-5">
          <p className="kicker text-bolt mb-3">Recent hail near you</p>
          <ul className="divide-y divide-line rounded-card border border-line">
            {data.recent!.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-7 w-11 shrink-0 items-center justify-center rounded text-xs font-bold text-ink"
                    style={{ background: dotColor(e.size) }}
                  >
                    {e.size}&quot;
                  </span>
                  <span className="text-sm text-fg-inv">{fmtDate(e.date)}</span>
                </div>
                <span className="text-right text-xs text-fg-inv-dim">
                  {e.city || e.county} · {e.miles}mi {cardinal(e.bearing)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-fg-inv-dim">
            Source: National Weather Service storm reports. Hail near you
            doesn&apos;t guarantee roof damage — a free inspection confirms it.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-md border border-line bg-ink p-3">
      <div className="font-display text-xl font-extrabold text-bolt">{big}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-fg-inv-dim">{small}</div>
    </div>
  );
}
