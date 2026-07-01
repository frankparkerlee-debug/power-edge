// Minimal Plaid REST helper — no SDK dependency, same fetch pattern as the rest
// of the app. Env-gated so the site runs clean until sandbox keys are set:
//   PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV=sandbox|development|production
//
// Phase 1 (this): Link + instant bank-verify underwrite (identity/balance/auth).
// Access tokens are used transiently and NOT persisted — recurring ACH via Plaid
// Transfer (Phase 2) is what needs a database + stored tokens + webhooks.

export function plaidConfig() {
  const client_id = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV || "sandbox").toLowerCase();
  const base =
    env === "production"
      ? "https://production.plaid.com"
      : env === "development"
        ? "https://development.plaid.com"
        : "https://sandbox.plaid.com";
  return { client_id, secret, env, base, enabled: !!(client_id && secret) };
}

export async function plaid<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { client_id, secret, base } = plaidConfig();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id, secret, ...body }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      (json && (json.error_message || json.error_code)) || `Plaid ${res.status}`,
    );
  }
  return json as T;
}
