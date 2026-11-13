import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { fieldReady, notReadyMessage } from "@/lib/fieldReady";
import { settleComeBacks } from "@/lib/knocks";

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
  const fr = await fieldReady(u);
  if (!fr.ready) return NextResponse.json({ error: notReadyMessage(fr.missing) }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // storm_targets.id is a uuid. This used to run it through Number(), which
  // yields NaN, so every disposition a rep tapped was rejected here and the
  // feature never once worked in production.
  const targetId = String(body.target_id || "");
  const outcome = String(body.outcome || "");
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
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

  // Attribution comes from the session. The client used to send ?rep= from
  // the URL, which nothing set once sign-in existed, so every knock was
  // recorded with no rep against it.
  const rep =
    u.name?.trim() ||
    String(body.rep || "").replace(/[^\w .'-]/g, "").slice(0, 40) ||
    null;
  const note = String(body.note || "").slice(0, 500) || null;

  // "Come back" carries when, so it lands on the setter's list at that time
  // instead of being a word nobody sees again. Anything else ignores it.
  let followUp: string | null = null;
  if (outcome === "come_back" && body.follow_up_at) {
    const t = new Date(String(body.follow_up_at));
    if (!Number.isNaN(t.getTime())) followUp = t.toISOString();
  }

  // Going back to a door settles whatever come-back brought you there, so
  // the list on Today clears itself instead of growing forever.
  await settleComeBacks(targetId);

  try {
    const res = await fetch(`${url}/rest/v1/knocks`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ target_id: targetId, outcome, rep, note, follow_up_at: followUp }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Could not save" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, outcome, rep });
  } catch {
    return NextResponse.json({ error: "Could not save" }, { status: 502 });
  }
}
