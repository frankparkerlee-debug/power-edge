import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { listJobPhotos, readJobPhoto } from "@/lib/held";

/** One inspection photo, for signed-in team members only (private bucket). */
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string; photoId: string }> }) {
  const u = await apiUser(req);
  if (!u) return new NextResponse("Not found", { status: 404 });
  const { id, photoId } = await ctx.params;
  const p = (await listJobPhotos(id)).find((x) => x.id === photoId);
  if (!p) return new NextResponse("Not found", { status: 404 });
  const buf = await readJobPhoto(p.path);
  if (!buf) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(buf as unknown as BodyInit, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
