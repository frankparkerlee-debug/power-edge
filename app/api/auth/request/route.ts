import { NextResponse } from "next/server";
import { issueLoginToken } from "@/lib/auth";
import { sendLoginLink } from "@/lib/emails";
import { burst, clientIp, tooMany } from "@/lib/rateLimit";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Per connection, generous: a whole crew signs in from the office Wi-Fi on
  // day one, and six per 15 minutes locked out the seventh rep. The tight
  // limit is per email address, which is what stops someone hammering one
  // inbox with links.
  const wait = burst(`login:${clientIp(req)}`, 30, 15 * 60_000);
  if (wait) return tooMany(wait, "Too many sign-in attempts. Try again shortly.");

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  const perEmail = burst(`login-email:${email.toLowerCase()}`, 5, 15 * 60_000);
  if (perEmail) return tooMany(perEmail, "Too many sign-in links for that email. Use the newest one, or try again shortly.");
  const token = await issueLoginToken(email);

  // Always report success. Saying "that email is not on the team" would let
  // anyone enumerate who works here.
  if (token && process.env.RESEND_API_KEY) {
    await sendLoginLink(process.env.RESEND_API_KEY, email, `${site.url}/auth/callback?t=${token}`);
  }
  return NextResponse.json({ ok: true });
}
