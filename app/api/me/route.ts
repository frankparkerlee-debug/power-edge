import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Who the portal shell should greet, and what to show them. */
export async function GET(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, name: u.name, email: u.email, role: u.role });
}
