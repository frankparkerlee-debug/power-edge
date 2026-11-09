/**
 * The single way this app talks to Resend.
 *
 * Why this exists: every send site used to be `await fetch(resend)` inside a
 * try/catch. fetch does not throw on an HTTP error, so a suppressed recipient
 * (403), an unverified domain (422) or a bad key (401) all looked like
 * success. That is exactly how lead notifications stopped arriving for months
 * with nothing in any log saying so.
 *
 * Every send now checks the status and records a failure row. The send stays
 * best-effort, because a mail problem must never cost us the lead or the
 * booking that was already written to the database, but it is no longer
 * silent.
 */

type SendArgs = {
  resendKey: string;
  kind: string; // "lead" | "appointment" | "claim" | "nurture" ...
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  scheduledAt?: string;
};

async function recordFailure(
  kind: string,
  to: string,
  subject: string,
  status: number | null,
  error: string,
) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Loud in the platform logs regardless of whether the DB write lands.
  console.error(
    `[mail] FAILED kind=${kind} to=${to} status=${status ?? "none"} error=${error.slice(0, 300)}`,
  );
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/email_failures`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        kind,
        to_addr: to,
        subject: subject.slice(0, 300),
        status,
        error: error.slice(0, 2000),
      }),
    });
  } catch {
    /* already logged */
  }
}

export type SendResult = { ok: boolean; status?: number; id?: string };

export async function sendMail(a: SendArgs): Promise<SendResult> {
  const to = Array.isArray(a.to) ? a.to : [a.to];
  const toLabel = to.join(",");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${a.resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: a.from,
        to,
        replyTo: a.replyTo,
        subject: a.subject,
        html: a.html,
        headers: a.headers,
        ...(a.scheduledAt ? { scheduled_at: a.scheduledAt } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      await recordFailure(a.kind, toLabel, a.subject, res.status, body);
      return { ok: false, status: res.status };
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, status: res.status, id: json?.id };
  } catch (err) {
    await recordFailure(a.kind, toLabel, a.subject, null, String(err));
    return { ok: false };
  }
}

/** Recent send failures, for the health page. */
export async function recentEmailFailures(limit = 20) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/email_failures?select=*&order=created_at.desc&limit=${limit}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as Array<Record<string, string | number>>;
  } catch {
    return [];
  }
}
