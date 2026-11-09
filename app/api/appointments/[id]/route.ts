import { NextResponse } from "next/server";
import { cancelAppointment } from "@/lib/scheduling";
import { burst, clientIp, tooMany } from "@/lib/rateLimit";

/** DELETE /api/appointments/:id — homeowner cancels from their confirmation link. */
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const wait = burst(`cancel:${clientIp(req)}`, 10, 10 * 60_000);
  if (wait) return tooMany(wait);

  const { id } = await ctx.params;
  const result = await cancelAppointment(id, "homeowner");
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
