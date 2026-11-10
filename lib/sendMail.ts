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

/**
 * Record every send with its resolved destination.
 *
 * Failures alone were not enough. When mail silently went to the wrong inbox
 * there was no record of WHERE it went, only that it had not errored, so
 * "did that lead notification reach us" was unanswerable after the fact.
 */
async function logSend(
  kind: string,
  to: string,
  subject: string,
  ok: boolean,
  status: number | null,
  providerId?: string,
  error?: string,
) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/email_log`, {
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
        ok,
        status,
        provider_id: providerId ?? null,
        error: error ? error.slice(0, 1000) : null,
      }),
    });
  } catch {
    /* logging must never break a send */
  }
}

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
      await logSend(a.kind, toLabel, a.subject, false, res.status, undefined, body);
      return { ok: false, status: res.status };
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string };
    await logSend(a.kind, toLabel, a.subject, true, res.status, json?.id);
    return { ok: true, status: res.status, id: json?.id };
  } catch (err) {
    await recordFailure(a.kind, toLabel, a.subject, null, String(err));
    await logSend(a.kind, toLabel, a.subject, false, null, undefined, String(err));
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

/**
 * The most recent sends, with their provider ids, so their real delivery
 * outcome can be looked up. email_log records that the provider accepted a
 * message, which is not the same as the person receiving it.
 */
export async function recentSends(limit = 12) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/email_log?select=created_at,kind,to_addr,provider_id&provider_id=not.is.null&order=created_at.desc&limit=${limit}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as Array<{
      created_at: string;
      kind: string;
      to_addr: string;
      provider_id: string;
    }>;
  } catch {
    return [];
  }
}
