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

/**
 * Setters book inspections, closers price and sign them. "rep" predates the
 * split and means both, so existing rows keep working.
 */
export type Role = "setter" | "closer" | "rep" | "admin";
export type Member = { id: number; email: string; name: string; role: Role };

/** Can this person price work and put an agreement in front of a homeowner? */
export function canSell(role?: Role) {
  return role === "closer" || role === "rep" || role === "admin";
}

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
      id: number; email: string; name: string; role: Role; exp: number;
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

/* ---------------------------------------------------------------------------
 * Managing who can sign in.
 *
 * Adding a rep meant someone with database access writing a row, which does
 * not survive hiring. These are admin-only and used by /admin/team.
 * ------------------------------------------------------------------------ */

export async function listMembers(): Promise<
  Array<Member & { active: boolean; last_login_at: string | null; created_at: string }>
> {
  if (!dbOn()) return [];
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/team_members?select=id,email,name,role,active,last_login_at,created_at&order=active.desc,name.asc`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** Roles a person can be given. "rep" is legacy and not offered for new people. */
export const ASSIGNABLE_ROLES: Array<{ role: Role; label: string; what: string }> = [
  { role: "setter", label: "Setter", what: "Knocks doors and books inspections." },
  { role: "closer", label: "Closer", what: "Runs inspections, prices work, writes agreements." },
  { role: "admin", label: "Admin", what: "Everything, including leads, territories and health." },
];

export async function addMember(input: { email: string; name: string; role: Role }) {
  if (!dbOn()) return { ok: false as const, error: "Not configured." };
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false as const, error: "That is not an email address." };
  }
  if (name.length < 2) return { ok: false as const, error: "Give them a name." };
  if (!ASSIGNABLE_ROLES.some((r) => r.role === input.role)) {
    return { ok: false as const, error: "Pick a role." };
  }
  // Someone already on the list, perhaps deactivated, is reactivated rather
  // than duplicated, so their history stays attached to one row.
  const existing = await findMember(email);
  if (existing) {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/team_members?email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH",
      headers: { ...headers(), Prefer: "return=minimal" },
      body: JSON.stringify({ active: true, role: input.role, name }),
    });
    return { ok: true as const, reactivated: true };
  }
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/team_members`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({ email, name, role: input.role, active: true }),
  });
  if (!res.ok) return { ok: false as const, error: "Could not add them." };
  return { ok: true as const, reactivated: false };
}

/**
 * Turn someone off rather than delete them.
 *
 * Their name is on knocks, jobs and signed agreements. Deleting the row would
 * orphan that history, and a signed contract needs to keep saying who wrote
 * it. Deactivating stops them signing in and leaves the record intact.
 */
export async function setMemberActive(id: number, active: boolean) {
  if (!dbOn()) return false;
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/team_members?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({ active }),
  });
  return res.ok;
}

export async function setMemberRole(id: number, role: Role) {
  if (!dbOn()) return false;
  if (!ASSIGNABLE_ROLES.some((r) => r.role === role)) return false;
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/team_members?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({ role }),
  });
  return res.ok;
}
