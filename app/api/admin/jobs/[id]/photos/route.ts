import { NextResponse } from "next/server";
import { apiUser, canSell } from "@/lib/auth";
import { getJob, logEvent } from "@/lib/jobs";
import { listJobPhotos, saveJobPhoto } from "@/lib/held";

/**
 * Inspection photos on a job.
 *
 *   GET  /api/admin/jobs/:id/photos   the list (any signed-in team member)
 *   POST /api/admin/jobs/:id/photos   one JPEG as the raw body (closers, admin)
 *
 * The phone shrinks each photo to a JPEG before sending, so the body is the
 * file itself, not a form. Photos are part of what makes an inspection held,
 * which is what pays the knocker's $50 (lib/held.ts).
 */
export const dynamic = "force-dynamic";

const MAX = 4 * 1024 * 1024;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const photos = await listJobPhotos(id);
  return NextResponse.json({ ok: true, photos: photos.map((p) => ({ id: p.id, at: p.created_at, by: p.by })) });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!canSell(u.role)) {
    return NextResponse.json({ ok: false, error: "Inspection photos are the closer's." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.byteLength) return NextResponse.json({ ok: false, error: "No photo came through." }, { status: 400 });
  if (buf.byteLength > MAX) return NextResponse.json({ ok: false, error: "That photo is too large." }, { status: 413 });
  // JPEG files start FF D8 FF. The phone converts everything to JPEG first.
  if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) {
    return NextResponse.json({ ok: false, error: "Send a JPEG photo." }, { status: 415 });
  }

  const r = await saveJobPhoto(id, buf, u.name);
  if (!r.ok) return NextResponse.json(r, { status: 502 });
  const count = (await listJobPhotos(id)).length;
  if (count === 1) await logEvent(id, "note", "First inspection photo added.", u.name);
  return NextResponse.json({ ok: true, id: r.id, count });
}
