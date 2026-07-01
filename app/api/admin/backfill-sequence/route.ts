import { NextResponse } from "next/server";
import { enqueueLeadSequence } from "@/lib/emails";

/**
 * One-time backfill: enroll everyone already in the Resend audience into the
 * lead email funnel, with the timer starting TODAY. Protected by ADMIN_TOKEN.
 *
 * Trigger once (from your machine):
 *   curl -X POST https://poweredgetx.com/api/admin/backfill-sequence \
 *        -H "x-admin-token: $ADMIN_TOKEN"
 *
 * Env required: RESEND_API_KEY, RESEND_AUDIENCE_ID, ADMIN_TOKEN.
 * It returns immediately and enrolls contacts in the background (throttled to
 * respect Resend's rate limit) on Render's persistent server. Run ONCE —
 * re-running double-sends to everyone.
 */

type Contact = {
  email?: string;
  first_name?: string;
  unsubscribed?: boolean;
};

export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || token !== adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!resendKey || !audienceId) {
    return NextResponse.json(
      { error: "RESEND_API_KEY and RESEND_AUDIENCE_ID must be set" },
      { status: 500 },
    );
  }

  // Pull the audience.
  let contacts: Contact[] = [];
  try {
    const res = await fetch(
      `https://api.resend.com/audiences/${audienceId}/contacts`,
      { headers: { Authorization: `Bearer ${resendKey}` } },
    );
    const json = (await res.json()) as { data?: Contact[] };
    contacts = json.data ?? [];
  } catch (err) {
    console.error("[backfill] failed to fetch audience", err);
    return NextResponse.json(
      { error: "Failed to fetch audience" },
      { status: 502 },
    );
  }

  const recipients = contacts.filter((c) => c.email && !c.unsubscribed);

  // Enroll in the background so the request returns fast; the throttle inside
  // enqueueLeadSequence keeps the whole run under Resend's rate limit.
  void (async () => {
    for (const c of recipients) {
      await enqueueLeadSequence({
        resendKey,
        to: c.email as string,
        ctx: { firstName: c.first_name || "there", existing: true },
      });
    }
    console.log(`[backfill] enrolled ${recipients.length} existing subscribers`);
  })().catch((err) => console.error("[backfill] run failed", err));

  return NextResponse.json({
    ok: true,
    started: recipients.length,
    skipped: contacts.length - recipients.length,
    note: "Enrollment running in background. Run this endpoint only once.",
  });
}
