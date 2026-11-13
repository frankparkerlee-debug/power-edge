import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { burst, tooMany } from "@/lib/rateLimit";
import { houseAt, houseByAddress } from "@/lib/coach/doors";
import { personaById, randomPersona } from "@/lib/coach/personas";
import { aiReady, offline, signScene } from "@/lib/coach/ai";

export const dynamic = "force-dynamic";

/**
 * Set up a practice door: the real house (from the knock map, or a typed
 * address) and a homeowner. Returns a signed scene the practice and score
 * calls carry, so the house and homeowner can't be swapped mid-conversation.
 *
 *   POST /api/coach/door { lat, lon, address } | { address } [, persona]
 */
export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const wait = burst(`coach:door:${u.id}`, 30, 10 * 60e3);
  if (wait) return tooMany(wait, "That's a lot of doors in a few minutes. Take a breather and try again.");

  let body: { lat?: number; lon?: number; address?: string; persona?: string; previous?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const address = String(body.address || "").trim().slice(0, 160);
  const lat = Number(body.lat), lon = Number(body.lon);
  let house = null;
  try {
    house =
      Number.isFinite(lat) && Number.isFinite(lon) && body.lat != null
        ? await houseAt(lat, lon, address)
        : address
          ? await houseByAddress(address)
          : null;
  } catch (err) {
    console.error("[coach/door]", err);
    return NextResponse.json({ ok: false, error: "Couldn't look up that house. Try again." }, { status: 502 });
  }
  if (!house) {
    return NextResponse.json(
      { ok: false, error: "Couldn't find that house in our storm data. Pick one on the Map, or try the full address with the city." },
      { status: 404 },
    );
  }

  const chosen = personaById(body.persona);
  const p = chosen ?? randomPersona(body.previous);
  const rep = (u.name || "").split(" ")[0] || "the rep";
  const scene = signScene({ v: 1, house, persona: p.id, rep, at: Date.now() });

  return NextResponse.json({
    ok: true,
    house,
    scene,
    offline: offline(),
    ready: aiReady() || offline(),
    // Who's at the door stays a surprise unless the rep picked one to drill.
    homeowner: { voice: p.voice, opening: p.opening, sign: !!p.sign, label: chosen ? p.label : null },
  });
}
