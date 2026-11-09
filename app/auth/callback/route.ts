import { redirect } from "next/navigation";
import { redeemLoginToken, startSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") || "";
  const member = await redeemLoginToken(token);
  if (!member) redirect("/login?e=expired");
  await startSession(member);
  // Everyone lands on Today. Dropping an admin on the playbook was the
  // "signing in lands on a document list" problem.
  redirect("/admin");
}
