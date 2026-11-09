import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Team sign-in.
 *
 * Replaces `?key=<ADMIN_TOKEN>` on every internal page. That scheme had two
 * problems: nobody could remember the token, and handing it to a door-knocker
 * also handed them the leads list, the territory board and a one-request CSV
 * export of all 11,856 homeowner records. A rep leaving meant rotating one
 * shared secret for everybody.
 *
 * Magic link rather than passwords: a field team on phones will not manage
 * passwords, and there is nothing to phish or reuse. Sessions last 30 days so
 * a rep signs in once a month, not once a morning.
 */

const SESSION_COOKIE = "pe_session";
const SESSION_DAYS = 30;
const TOKEN_TTL_MIN = 20;

function secret() {
  // ADMIN_TOKEN already exists and is secret. Using it as the signing key
  // avoids a new env var; rotating it invalidates every session, which is the
  // behaviour you want from a break-glass credential anyway.
  const s = process.env.ADMIN_TOKEN;
  if (!s) throw new Error("ADMIN_TOKEN must be set to sign sessions");
  return s;
}

const dbOn = () =>
  !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export type Member = { id: number; email: string; name: string; role: "rep" | "admin" };

export async function findMember(email: string): Promise<Member | null> {
  if (!dbOn() || !email) return null;
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/team_members?select=id,email,name,role&active=is.true&email=ilike.${encodeURIComponent(email.trim())}`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Member[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Create a single-use link token. Returns null when the email is not on the team. */
export async function issueLoginToken(email: string): Promise<string | null> {
  const member = await findMember(email);
  if (!member) return null;
  const token = randomBytes(24).toString("hex");
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/login_tokens`, {
      method: "POST",
      headers: { ...headers(), Prefer: "return=minimal" },
      body: JSON.stringify({
        token,
        email: member.email,
        expires_at: new Date(Date.now() + TOKEN_TTL_MIN * 60_000).toISOString(),
      }),
    });
    if (!res.ok) return null;
    return token;
  } catch {
    return null;
  }
}

/**
 * Redeem a token. Stamps used_at in the same request that reads it, and only
 * where used_at is still null, so a link that is forwarded or sitting in a
 * mailbox cannot be redeemed twice.
 */
export async function redeemLoginToken(token: string): Promise<Member | null> {
  if (!dbOn() || !/^[0-9a-f]{48}$/.test(token)) return null;
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/login_tokens?token=eq.${token}&used_at=is.null&expires_at=gt.${new Date().toISOString()}`,
      {
        method: "PATCH",
        headers: { ...headers(), Prefer: "return=representation" },
        body: JSON.stringify({ used_at: new Date().toISOString() }),
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ email: string }>;
    if (rows.length === 0) return null;
    const member = await findMember(rows[0].email);
    if (member) {
      void fetch(
        `${process.env.SUPABASE_URL}/rest/v1/team_members?id=eq.${member.id}`,
        {
          method: "PATCH",
          headers: { ...headers(), Prefer: "return=minimal" },
          body: JSON.stringify({ last_login_at: new Date().toISOString() }),
        },
      ).catch(() => {});
    }
    return member;
  } catch {
    return null;
  }
}

// ---- session cookie ------------------------------------------------------

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

// JSON rather than a delimited string: names contain dots and spaces, and the
// rep's name is what gets attributed to every door they knock.
function encode(m: Member) {
  const payload = JSON.stringify({
    id: m.id,
    email: m.email,
    name: m.name,
    role: m.role,
    exp: Date.now() + SESSION_DAYS * 86_400_000,
  });
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

function decode(value: string): Member | null {
  const idx = value.lastIndexOf(".");
  if (idx < 1) return null;
  const b64 = value.slice(0, idx);
  const mac = value.slice(idx + 1);

  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString();
  } catch {
    return null;
  }
  const expected = sign(payload);
  // Constant-time compare so the MAC cannot be probed byte by byte.
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;

  try {
    const d = JSON.parse(payload) as {
      id: number; email: string; name: string; role: "rep" | "admin"; exp: number;
    };
    if (!d.exp || d.exp < Date.now()) return null;
    return { id: d.id, email: d.email, name: d.name, role: d.role };
  } catch {
    return null;
  }
}

export async function startSession(m: Member) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encode(m), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Who is signed in, if anyone.
 *
 * `?key=<ADMIN_TOKEN>` still works as a break-glass path so nobody is locked
 * out of production while the team is being set up. It should go once everyone
 * has an account.
 */
export async function currentUser(keyParam?: string): Promise<Member | null> {
  if (keyParam && process.env.ADMIN_TOKEN && keyParam === process.env.ADMIN_TOKEN) {
    return { id: 0, email: "break-glass", name: "Office", role: "admin" };
  }
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decode(raw);
}

export async function requireAdmin(keyParam?: string) {
  const u = await currentUser(keyParam);
  return u?.role === "admin" ? u : null;
}

/**
 * API-side auth. Accepts a signed-in session (cookie rides along with fetch)
 * or the break-glass token header. Used by the admin routes so the same
 * endpoints work from a logged-in page and from a script.
 */
export async function apiUser(req: Request): Promise<Member | null> {
  const header = req.headers.get("x-admin-token");
  if (header && process.env.ADMIN_TOKEN && header === process.env.ADMIN_TOKEN) {
    return { id: 0, email: "break-glass", name: "Office", role: "admin" };
  }
  const keyParam = new URL(req.url).searchParams.get("key") ?? undefined;
  return currentUser(keyParam);
}
