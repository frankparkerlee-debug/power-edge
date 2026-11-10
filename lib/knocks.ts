/**
 * Come-backs: doors a setter promised to return to.
 *
 * "Come back" used to be an outcome with no time attached and no list it
 * would ever appear on, which is how an appointment quietly never happens.
 * Each one now carries follow_up_at, and this is the list it lands on.
 */

const dbOn = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
function h() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export type ComeBack = {
  id: number;
  follow_up_at: string;
  note: string | null;
  rep: string | null;
  target_id: string;
  address: string;
  owner_name: string | null;
  phone: string | null;
  overdue: boolean;
};

/**
 * Open come-backs, soonest first. A setter sees their own; pass no rep for
 * everyone's, which is what the office wants.
 */
export async function listComeBacks(rep?: string, limit = 50): Promise<ComeBack[]> {
  if (!dbOn()) return [];
  try {
    const q = [
      "select=id,follow_up_at,note,rep,target_id",
      "follow_up_at=not.is.null",
      "done_at=is.null",
      "outcome=eq.come_back",
      "order=follow_up_at.asc",
      `limit=${limit}`,
    ];
    if (rep) q.push(`rep=eq.${encodeURIComponent(rep)}`);
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/knocks?${q.join("&")}`, {
      headers: h(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Omit<ComeBack, "address" | "owner_name" | "phone" | "overdue">>;
    if (rows.length === 0) return [];

    // Two queries rather than an embed: it does not depend on a foreign key
    // existing between knocks and storm_targets.
    const ids = [...new Set(rows.map((r) => r.target_id))].join(",");
    const tr = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/storm_targets?select=id,address,owner_name,phone&id=in.(${ids})`,
      { headers: h(), cache: "no-store" },
    );
    const doors = tr.ok
      ? ((await tr.json()) as Array<{ id: string; address: string; owner_name: string | null; phone: string | null }>)
      : [];
    const byId = new Map(doors.map((d) => [d.id, d]));
    const now = Date.now();
    return rows.map((r) => {
      const d = byId.get(r.target_id);
      return {
        ...r,
        address: d?.address ?? "Address not found",
        owner_name: d?.owner_name ?? null,
        phone: d?.phone ?? null,
        overdue: new Date(r.follow_up_at).getTime() < now,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Close any open come-back on a door once someone has been back to it.
 * Called when a new knock is recorded, so the list clears itself.
 */
export async function settleComeBacks(targetId: string) {
  if (!dbOn() || !targetId) return;
  try {
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/knocks?target_id=eq.${targetId}&outcome=eq.come_back&done_at=is.null`,
      {
        method: "PATCH",
        headers: { ...h(), Prefer: "return=minimal" },
        body: JSON.stringify({ done_at: new Date().toISOString() }),
      },
    );
  } catch {
    /* a stale come-back is a nuisance, not a failure */
  }
}
