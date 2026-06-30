import { cities } from "@/lib/cities";

// Shared, layered address → coordinates geocoder used by the storm and roof
// tools. All free, no API keys. Resolves clean addresses, partial/typo'd ones,
// bare ZIPs, and city names.

export type Geo = {
  lat: number;
  lon: number;
  matched: string;
  approximate: boolean; // false only for a precise rooftop street match
};

export async function geocode(address: string): Promise<Geo | null> {
  // 1. Precise street address (US Census rooftop geocoder).
  try {
    const url =
      "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=" +
      encodeURIComponent(address) +
      "&benchmark=Public_AR_Current&format=json";
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      const m = data?.result?.addressMatches?.[0];
      if (m) {
        return {
          lat: m.coordinates.y,
          lon: m.coordinates.x,
          matched: m.matchedAddress,
          approximate: false,
        };
      }
    }
  } catch {
    /* fall through */
  }

  // 2. Forgiving rooftop-ish match — OpenStreetMap Nominatim handles partial,
  //    non-standardized, or typo'd street addresses (and cities) the strict
  //    Census geocoder rejects, and returns a point near the actual property
  //    (better for roof measurement than a ZIP centroid). Free, no key.
  try {
    const q = /\bTX\b|texas/i.test(address) ? address : `${address}, TX`;
    const nUrl =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=" +
      encodeURIComponent(q);
    const res = await fetch(nUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "poweredgetx.com/1.0 (info@poweredgetx.com)" },
    });
    if (res.ok) {
      const arr = await res.json();
      const m = arr?.[0];
      if (m?.lat && m?.lon) {
        // A house/building-level OSM hit is effectively rooftop-precise.
        const precise = m.class === "place" && m.type === "house";
        return {
          lat: parseFloat(m.lat),
          lon: parseFloat(m.lon),
          matched: address,
          approximate: !precise,
        };
      }
    }
  } catch {
    /* fall through */
  }

  // 3. ZIP centroid (Zippopotam) — last resort when no street match.
  const zip = address.match(/\b(\d{5})\b/)?.[1];
  if (zip) {
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        const p = data?.places?.[0];
        if (p) {
          return {
            lat: parseFloat(p.latitude),
            lon: parseFloat(p.longitude),
            matched: `${p["place name"]}, ${p["state abbreviation"]} ${zip}`,
            approximate: true,
          };
        }
      }
    } catch {
      /* fall through */
    }
  }

  // 4. Known service-area city by name.
  const lower = address.toLowerCase();
  const city = cities.find((c) => lower.includes(c.name.toLowerCase()));
  if (city) {
    return { lat: city.lat, lon: city.lon, matched: `${city.name}, TX`, approximate: true };
  }

  return null;
}
