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

/**
 * Create a single-use link token. Returns null when the email is not on the team.
 *
 * A link someone asked for lives 20 minutes. Onboarding emails pass a longer
 * life (3 days) because a new rep may open the welcome the next morning; the
 * link still works only once.
 */
export async function issueLoginToken(email: string, ttlMin = TOKEN_TTL_MIN): Promise<string | null> {
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
        expires_at: new Date(Date.now() + ttlMin * 60_000).toISOString(),
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
  const session = decode(raw);
  if (!session) return null;

  const now = await memberNow(session.id);
  if (now === null) return null; // removed or deactivated since signing in
  return now ?? session; // the team table could not be read: trust the signature
}

/*
 * The cookie says who someone was when they signed in. The team table says who
 * they are now.
 *
 * Sessions last 30 days and used to be trusted on the cookie alone, so taking
 * someone off the team, or switching them off, changed nothing for anyone
 * already signed in: a rep who left kept the portal and its homeowner records
 * for up to a month, and a demoted admin stayed an admin. Found 2026-11-11
 * when a deleted test account was still getting in.
 *
 * Now every request checks the row, cached for a minute so a page with
 * several server calls does not hit the database for each. A change on the
 * Team page clears the cache on this instance; any other instance catches up
 * within the minute. If the database cannot be reached the signed cookie is
 * trusted, because locking the whole team out during a blip is worse.
 */
const MEMBER_TTL_MS = 60_000;
const memberCache = new Map<number, { at: number; member: Member | null }>();

/** The member as the team table has them now. null = not active; undefined = could not check. */
async function memberNow(id: number): Promise<Member | null | undefined> {
  const hit = memberCache.get(id);
  if (hit && Date.now() - hit.at < MEMBER_TTL_MS) return hit.member;
  if (!dbOn()) return undefined;
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/team_members?select=id,email,name,role&active=is.true&id=eq.${Number(id)}`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return undefined;
    const rows = (await res.json()) as Member[];
    const member = rows[0] ?? null;
    memberCache.set(id, { at: Date.now(), member });
    return member;
  } catch {
    return undefined;
  }
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
  Array<
    Member & {
      active: boolean;
      last_login_at: string | null;
      created_at: string;
      goal_knocks_week: number | null;
      goal_sets_week: number | null;
      goal_signed_month: number | null;
      team_id: number | null;
      takes_inspections: boolean;
      onboarding_started_at: string | null;
    }
  >
> {
  if (!dbOn()) return [];
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/team_members?select=id,email,name,role,active,last_login_at,created_at,goal_knocks_week,goal_sets_week,goal_signed_month,team_id,takes_inspections,onboarding_started_at&order=active.desc,name.asc`,
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
      body: JSON.stringify({ active: true, role: input.role, name, ...(input.role === "closer" ? { takes_inspections: true } : {}) }),
    });
    return { ok: true as const, reactivated: true, id: existing.id };
  }
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/team_members?select=id`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    // A closer drives to inspections from day one. Booking only offers a
    // window when someone who takes inspections is free in it, and nothing
    // set this flag, so a new closer never got a single booking.
    body: JSON.stringify({ email, name, role: input.role, active: true, takes_inspections: input.role === "closer" }),
  });
  if (!res.ok) return { ok: false as const, error: "Could not add them." };
  const rows = (await res.json().catch(() => [])) as Array<{ id: number }>;
  return { ok: true as const, reactivated: false, id: rows[0]?.id ?? null };
}

/**
 * Turn someone off rather than delete them.
 *
 * Their name is on knocks, jobs and signed agreements. Deleting the row would
 * orphan that history, and a signed contract needs to keep saying who wrote
 * it. Deactivating stops them signing in and leaves the record intact.
 */
/** Whether booking may put this person on inspections. */
export async function setMemberInspections(id: number, takes: boolean) {
  if (!dbOn()) return false;
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/team_members?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({ takes_inspections: takes }),
  });
  return res.ok;
}

export async function setMemberActive(id: number, active: boolean) {
  if (!dbOn()) return false;
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/team_members?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({ active }),
  });
  memberCache.delete(id);
  return res.ok;
}

/* ---------------------------------------------------------------------------
 * Teams: a closer and the knockers who feed them. Admin-only, from /admin/team.
 * A person is on at most one team; the scoreboard shows each rep their team.
 * ------------------------------------------------------------------------ */

export type Team = { id: number; name: string; active: boolean };

export async function listTeams(): Promise<Team[]> {
  if (!dbOn()) return [];
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/teams?select=id,name,active&order=active.desc,name.asc`, {
      headers: headers(),
      cache: "no-store",
    });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function createTeam(name: string) {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!dbOn() || !clean) return false;
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/teams`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({ name: clean }),
  });
  return res.ok;
}

export async function updateTeam(id: number, patch: { name?: string; active?: boolean }) {
  if (!dbOn()) return false;
  const body: Record<string, unknown> = {};
  if (patch.name != null) {
    const clean = patch.name.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!clean) return false;
    body.name = clean;
  }
  if (patch.active != null) body.active = patch.active;
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/teams?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  // A retired team's people are nobody's team until they are moved.
  if (res.ok && patch.active === false) {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/team_members?team_id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers(), Prefer: "return=minimal" },
      body: JSON.stringify({ team_id: null }),
    });
  }
  return res.ok;
}

export async function setMemberTeam(id: number, teamId: number | null) {
  if (!dbOn()) return false;
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/team_members?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({ team_id: teamId }),
  });
  return res.ok;
}

/**
 * A person's goals for the scoreboard. Blank means the team default, so a
 * cleared field puts them back on it.
 */
export async function setMemberGoals(
  id: number,
  goals: { knocksWeek: number | null; setsWeek: number | null; signedMonth: number | null },
) {
  if (!dbOn()) return false;
  const clean = (v: number | null, max: number) =>
    v == null || !Number.isFinite(v) || v <= 0 ? null : Math.min(Math.round(v), max);
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/team_members?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({
      goal_knocks_week: clean(goals.knocksWeek, 5000),
      goal_sets_week: clean(goals.setsWeek, 500),
      goal_signed_month: clean(goals.signedMonth, 10_000_000),
    }),
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
  memberCache.delete(id);
  return res.ok;
}
