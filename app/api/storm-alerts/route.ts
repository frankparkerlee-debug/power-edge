import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { geocode } from "@/lib/geocode";
import { burst, clientIp, tooMany } from "@/lib/rateLimit";
import { CONSENT_TEXT, CONSENT_VERSION } from "@/lib/stormConsent";

export const dynamic = "force-dynamic";

/**
 * Storm-alert signup. Public, because a homeowner fills it in on the setter's
 * phone or from a QR code. When a team member is signed in on the device, the
 * signup is credited to them and marked as taken at the door.
 */

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function e164(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  // A setter signs up door after door from one phone, so the limit is for
  // the public form only.
  const user = await currentUser().catch(() => null);
  if (!user) {
    const wait = burst(`storm-alerts:${ip}`, 5, 10 * 60_000);
    if (wait) return tooMany(wait);
  }

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Bots: a filled honeypot or a form submitted faster than a person types
  // gets a quiet success and nothing is stored.
  if (String(b.company_website || "") || Number(b.form_elapsed_ms || 0) < 2500) {
    return NextResponse.json({ ok: true });
  }

  const name = String(b.name || "").trim().slice(0, 120);
  const phone = e164(String(b.phone || ""));
  const email = String(b.email || "").trim().slice(0, 160) || null;
  const address = String(b.address || "").trim().replace(/\s+/g, " ").slice(0, 160);
  const signature = String(b.signature || "").trim().slice(0, 120);
  const agreed = b.agree === true;

  if (!name || !address) return NextResponse.json({ error: "Name and address are required." }, { status: 422 });
  if (!phone) return NextResponse.json({ error: "Enter a 10-digit mobile number." }, { status: 422 });
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 422 });
  }
  if (!agreed || signature.length < 3) {
    return NextResponse.json({ error: "Check the box and type your name to sign." }, { status: 422 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Signups are offline. Try again later." }, { status: 503 });
  }

  // Location: from the door card when the setter opened the form there,
  // otherwise from the address.
  let lat = Number(b.lat);
  let lon = Number(b.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0) {
    const g = await geocode(address).catch(() => null);
    lat = g?.lat ?? NaN;
    lon = g?.lon ?? NaN;
  }

  const targetId = /^[0-9a-f-]{36}$/i.test(String(b.target_id || "")) ? String(b.target_id) : null;
  const row = {
    name,
    phone,
    email,
    address,
    zip: (address.match(/\b(\d{5})(?:-\d{4})?\s*$/) || [])[1] ?? null,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    target_id: targetId,
    rep: user?.name ?? null,
    source: user ? "door" : "web",
    consent_text: CONSENT_TEXT,
    consent_version: CONSENT_VERSION,
    signature,
    consent_at: new Date().toISOString(),
    consent_ip: ip.slice(0, 64),
    consent_ua: (req.headers.get("user-agent") || "").slice(0, 300),
    opted_out_at: null,
  };

  // One row per phone and address. Signing again refreshes the consent and
  // clears an earlier opt-out, because the homeowner just asked again.
  const base = `${process.env.SUPABASE_URL}/rest/v1/alert_signups`;
  const found = await fetch(
    `${base}?select=id&phone=eq.${encodeURIComponent(phone)}&address=ilike.${encodeURIComponent(address)}&limit=1`,
    { headers: db(), cache: "no-store" },
  );
  const existing = found.ok ? ((await found.json()) as Array<{ id: string }>)[0] : undefined;
  const res = existing
    ? await fetch(`${base}?id=eq.${existing.id}`, {
        method: "PATCH",
        headers: { ...db(), Prefer: "return=minimal" },
        body: JSON.stringify(row),
      })
    : await fetch(base, {
        method: "POST",
        headers: { ...db(), Prefer: "return=minimal" },
        body: JSON.stringify(row),
      });
  if (!res.ok) return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 502 });

  return NextResponse.json({ ok: true, located: row.lat != null });
}
