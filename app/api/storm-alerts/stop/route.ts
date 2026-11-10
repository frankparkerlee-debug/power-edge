import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { stopToken } from "@/lib/stormWarnings";

export const dynamic = "force-dynamic";

/** One-tap opt-out from a storm-alert email (and later, the text STOP flow). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const s = url.searchParams.get("s") || "";
  const done = new URL("/storm-alerts/stopped", url.origin);

  const valid =
    /^[0-9a-f-]{36}$/i.test(id) &&
    s.length === 32 &&
    timingSafeEqual(Buffer.from(s), Buffer.from(stopToken(id)));
  if (!valid || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    done.searchParams.set("e", "1");
    return NextResponse.redirect(done);
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/alert_signups?id=eq.${id}&opted_out_at=is.null`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ opted_out_at: new Date().toISOString() }),
  });
  return NextResponse.redirect(done);
}
