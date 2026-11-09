import { redirect } from "next/navigation";
import { redeemLoginToken, startSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") || "";
  const member = await redeemLoginToken(token);
  if (!member) redirect("/login?e=expired");
  await startSession(member);
  redirect(member.role === "admin" ? "/sales" : "/admin/storms");
}
