import { NextResponse } from "next/server";
import { issueLoginToken } from "@/lib/auth";
import { sendLoginLink } from "@/lib/emails";
import { burst, clientIp, tooMany } from "@/lib/rateLimit";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const wait = burst(`login:${clientIp(req)}`, 6, 15 * 60_000);
  if (wait) return tooMany(wait, "Too many sign-in attempts. Try again shortly.");

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  const token = await issueLoginToken(email);

  // Always report success. Saying "that email is not on the team" would let
  // anyone enumerate who works here.
  if (token && process.env.RESEND_API_KEY) {
    await sendLoginLink(process.env.RESEND_API_KEY, email, `${site.url}/auth/callback?t=${token}`);
  }
  return NextResponse.json({ ok: true });
}
