"use client";

import { TILES } from "@/lib/basemap";

/**
 * The actual roof, from above: a few aerial tiles centered on the house, the
 * same Esri imagery the knock map's Aerial view uses (no key, no new vendor).
 */

const Z = 19;
const SIZE = 256;

export function HouseAerial({ lat, lon, height = 176 }: { lat: number; lon: number; height?: number }) {
  const n = 2 ** Z;
  const xf = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  // A 4 x 3 block of tiles around the house covers any phone width.
  const x0 = Math.floor(xf) - 1;
  const y0 = Math.floor(yf) - 1;
  const cx = (xf - x0) * SIZE;
  const cy = (yf - y0) * SIZE;
  const tiles: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) tiles.push({ x: x0 + dx, y: y0 + dy });

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e3e6ea] bg-[#d9dcd5]" style={{ height }}>
      <div className="absolute" style={{ left: `calc(50% - ${cx}px)`, top: `calc(50% - ${cy}px)`, width: SIZE * 4, height: SIZE * 3 }}>
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${t.x}-${t.y}`}
            src={TILES.satellite.replace("{z}", String(Z)).replace("{y}", String(t.y)).replace("{x}", String(t.x))}
            alt=""
            width={SIZE}
            height={SIZE}
            className="absolute max-w-none select-none"
            style={{ left: (t.x - x0) * SIZE, top: (t.y - y0) * SIZE }}
            draggable={false}
          />
        ))}
      </div>
      {/* The house */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#7FFBAE] shadow-[0_0_0_2px_rgba(11,14,19,0.55)]" />
      <span className="absolute bottom-1 right-1.5 text-[10px] text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">Imagery © Esri</span>
    </div>
  );
}
