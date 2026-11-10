/**
 * What actually happened to an email after we handed it over.
 *
 * sendMail records the HTTP response from the send call, and a 200 there
 * means accepted for delivery, nothing more. An address that is on the
 * provider's suppression list, or that hard bounces a second later, or that
 * the receiving side silently junks, all look identical at that moment: ok,
 * 200, no error.
 *
 * So the health page could say "no failures in 24h" while an agreement sat
 * undelivered, which is precisely what happened. Asking the provider what
 * became of each message is the only way to know.
 */

export type Delivery = {
  id: string;
  to: string;
  subject: string;
  /** delivered, bounced, complained, delivery_delayed, queued, sent... */
  event: string;
  at: string | null;
};

const TERMINAL_BAD = ["bounced", "complained", "failed"];

export function isBad(event: string) {
  return TERMINAL_BAD.includes(event);
}

/** Ask Resend what happened to one message. */
export async function deliveryStatus(providerId: string): Promise<Delivery | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !providerId) return null;
  try {
    const res = await fetch(`https://api.resend.com/emails/${providerId}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      id?: string;
      to?: string[] | string;
      subject?: string;
      last_event?: string;
      created_at?: string;
    };
    return {
      id: String(d.id || providerId),
      to: Array.isArray(d.to) ? d.to.join(", ") : String(d.to || ""),
      subject: String(d.subject || ""),
      event: String(d.last_event || "unknown"),
      at: d.created_at ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Status for several messages at once, for the health page.
 * Capped, because this is one request per message.
 */
export async function deliveryStatuses(providerIds: string[], cap = 12) {
  const ids = providerIds.filter(Boolean).slice(0, cap);
  const out = await Promise.all(ids.map((id) => deliveryStatus(id)));
  return out.filter(Boolean) as Delivery[];
}
