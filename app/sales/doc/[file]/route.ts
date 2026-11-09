import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Gated PDF delivery for the sales repo.
 *
 * The documents live in print/sales/pdf/, NOT in public/. Anything under
 * public/ is fetchable by URL and would have put our call scripts, our
 * territory data, and an unreviewed legal agreement one guess away from being
 * crawled. This route checks the same key as the repo page before streaming
 * the file.
 */
export const dynamic = "force-dynamic";

const DIR = path.join(process.cwd(), "print", "sales", "pdf");

export async function GET(
  req: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const gate = process.env.SALES_KEY || process.env.ADMIN_TOKEN;
  const key = new URL(req.url).searchParams.get("key");
  if (!gate || key !== gate) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { file } = await ctx.params;
  // Whitelist the shape rather than trying to sanitise a path.
  if (!/^[0-9]{2}-[a-z0-9-]+\.pdf$/.test(file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const buf = await readFile(path.join(DIR, file));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${file}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
