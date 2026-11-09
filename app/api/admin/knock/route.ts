import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";

/**
 * Door-knock dispositions.
 *
 * Writes to `knocks`, not to storm_targets.status. Target rows are regenerated
 * by the hourly storm job, and a regen must never erase what a rep recorded in
 * the field. Latest row per target is the current state, and keeping the
 * history means we can tell "nobody has been here" from "three reps have been
 * here and nobody was home."
 */
export const dynamic = "force-dynamic";

const OUTCOMES = [
  "not_home",
  "not_interested",
  "come_back",
  "appointment_set",
  "inspected",
  "already_done",
  "do_not_knock",
] as const;

export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const targetId = Number(body.target_id);
  const outcome = String(body.outcome || "");
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return NextResponse.json({ error: "Bad target_id" }, { status: 422 });
  }
  if (!(OUTCOMES as readonly string[]).includes(outcome)) {
    return NextResponse.json({ error: "Bad outcome" }, { status: 422 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "DB not configured" }, { status: 503 });
  }

  const rep = String(body.rep || "").replace(/[^\w .'-]/g, "").slice(0, 40) || null;
  const note = String(body.note || "").slice(0, 500) || null;

  try {
    const res = await fetch(`${url}/rest/v1/knocks`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ target_id: targetId, outcome, rep, note }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Could not save" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, outcome, rep });
  } catch {
    return NextResponse.json({ error: "Could not save" }, { status: 502 });
  }
}
