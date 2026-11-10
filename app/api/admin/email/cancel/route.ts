import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";

/**
 * Stop a nurture sequence that has not gone out yet.
 *
 * The lead sequence schedules all eight emails with the provider the moment a
 * lead arrives, days in advance. That is fine until the reason for sending
 * them stops being true: the homeowner signs, or asks us to stop, or the lead
 * turns out to be a virtual assistant agency. Then there are seven more
 * marketing emails already queued and nothing to call them back with.
 *
 * Sending drip mail to addresses that did not want it is also how a sending
 * domain's reputation gets spent, which costs the deliverability of the
 * agreements that genuinely matter.
 *
 *   POST /api/admin/email/cancel   { to: "someone@example.com" }
 *
 * Only cancels scheduled sequence mail. Anything already delivered is gone,
 * and transactional mail (agreements, confirmations) is never touched.
 */
export const dynamic = "force-dynamic";

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: { to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const to = String(body.to || "").trim().toLowerCase();
  if (!to.includes("@")) {
    return NextResponse.json({ ok: false, error: "Need an email address." }, { status: 400 });
  }
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !process.env.SUPABASE_URL) {
    return NextResponse.json({ ok: false, error: "Not configured" }, { status: 500 });
  }

  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/email_log` +
      `?select=provider_id,kind&to_addr=ilike.${encodeURIComponent(to)}` +
      `&kind=like.sequence:*&provider_id=not.is.null&order=created_at.desc&limit=50`,
    { headers: db(), cache: "no-store" },
  );
  const rows = res.ok
    ? ((await res.json()) as Array<{ provider_id: string; kind: string }>)
    : [];

  let cancelled = 0;
  const alreadyGone: string[] = [];
  for (const r of rows) {
    try {
      const c = await fetch(`https://api.resend.com/emails/${r.provider_id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      // A 4xx here usually means it already sent, which is not an error worth
      // failing the whole call over.
      if (c.ok) cancelled++;
      else alreadyGone.push(r.kind);
    } catch {
      alreadyGone.push(r.kind);
    }
  }

  return NextResponse.json({ ok: true, to, found: rows.length, cancelled, alreadyGone });
}
