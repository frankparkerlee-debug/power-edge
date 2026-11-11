import { redirect } from "next/navigation";
import { currentUser, redeemLoginToken, startSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Where a link may send someone after signing in. Only our own portal pages,
 * so a crafted link can't bounce a rep to another site.
 */
function safeNext(raw: string | null) {
  if (!raw) return "/admin";
  if (!/^\/admin(\/[\w/-]*)?(\?[\w=&%.-]*)?$/.test(raw)) return "/admin";
  return raw;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const next = safeNext(q.get("next"));
  const member = await redeemLoginToken(q.get("t") || "");
  if (!member) {
    // An onboarding email opened twice, or after it expired, by someone
    // who is already signed in: take them where the email pointed.
    if (await currentUser()) redirect(next);
    redirect("/login?e=expired");
  }
  await startSession(member);
  // Everyone lands on Today unless the link says otherwise (onboarding
  // emails open the checklist at the step they're about).
  redirect(next);
}
