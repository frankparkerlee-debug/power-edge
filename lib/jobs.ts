/**
 * Jobs: the CRM spine.
 *
 * Before this, storm_targets, leads, appointments, knocks and contracts were
 * five tables with no relationship. You could see that a door was knocked and
 * separately that an inspection was booked, but nothing said they were the
 * same house, and nothing could answer "what is happening at 545 Crystal
 * Springs". A job is that record.
 */

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

export const STAGES = [
  "new",
  "contacted",
  "inspection_booked",
  "inspected",
  "agreement_sent",
  "signed",
  "in_production",
  "complete",
] as const;

export type Stage = (typeof STAGES)[number] | "lost";

export const STAGE_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  inspection_booked: "Inspection booked",
  inspected: "Inspected",
  agreement_sent: "Agreement sent",
  signed: "Signed",
  in_production: "In production",
  complete: "Complete",
  lost: "Lost",
};

/** What the office should chase, in the order it costs money to ignore. */
export const STAGE_URGENCY: Record<string, number> = {
  agreement_sent: 1,
  inspected: 2,
  inspection_booked: 3,
  contacted: 4,
  new: 5,
  signed: 6,
  in_production: 7,
  complete: 9,
  lost: 10,
};

export type Job = {
  id: string;
  created_at: string;
  updated_at: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  address: string;
  city: string | null;
  zip: string | null;
  stage: Stage;
  job_type: "claim" | "cash";
  /** Who owns it right now. */
  rep: string | null;
  /**
   * Durable credit, because a job has two people on it.
   *
   * The setter knocked the door and put the inspection on the calendar; the
   * closer turned up, priced it and got it signed. rep used to be the only
   * field and whoever acted last won it, so writing the agreement erased the
   * setter at the exact moment the job became worth money.
   */
  setter: string | null;
  closer: string | null;
  squares: number | null;
  carrier: string | null;
  claim_number: string | null;
  deductible: string | null;
  contract_value: string | null;
  notes: string | null;
  /** uuid, matching storm_targets.id. Was typed number before that column
   *  was corrected from bigint. */
  storm_target_id: string | null;
  /** Carried so fresh hail can be matched against open jobs, which is what
   *  HubSpot used to do against contacts. */
  lat: number | null;
  lon: number | null;
  last_storm_alert_at: string | null;
  appointment_id: string | null;
  contract_id: string | null;
  /** Why a job ended without a sale, e.g. "Roof is fine, no claim". */
  lost_reason: string | null;
  /**
   * What the roof brought in and cost, entered by the office. final_value
   * replaces the contract value once supplements are settled. Profit is
   * final (or contract) value minus the four costs.
   */
  final_value?: number | null;
  cost_materials?: number | null;
  cost_labor?: number | null;
  cost_other?: number | null;
  cost_commission?: number | null;
  costs_entered_at?: string | null;
  costs_by?: string | null;
};

export async function listJobs(opts: { rep?: string; stage?: string; limit?: number } = {}) {
  if (!dbOn()) return [];
  const q: string[] = ["select=*", "order=updated_at.desc", `limit=${opts.limit ?? 200}`];
  if (opts.stage) q.push(`stage=eq.${opts.stage}`);
  if (opts.rep) q.push(`rep=ilike.${encodeURIComponent(opts.rep)}`);
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/jobs?${q.join("&")}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as Job[];
  } catch {
    return [];
  }
}

export async function getJob(id: string): Promise<Job | null> {
  if (!dbOn() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/jobs?select=*&id=eq.${id}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Job[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function jobTimeline(id: string) {
  if (!dbOn()) return [];
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/job_events?select=*&job_id=eq.${id}&order=created_at.desc&limit=100`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return [];
    return (await res.json()) as Array<{
      id: number; created_at: string; kind: string; detail: string | null; actor: string | null;
    }>;
  } catch {
    return [];
  }
}

export async function logEvent(jobId: string, kind: string, detail?: string, actor?: string) {
  if (!dbOn()) return;
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/job_events`, {
      method: "POST",
      headers: { ...headers(), Prefer: "return=minimal" },
      body: JSON.stringify({ job_id: jobId, kind, detail: detail ?? null, actor: actor ?? null }),
    });
  } catch {
    /* a timeline gap must never break the action it was describing */
  }
}

export async function createJob(
  input: Partial<Job> & { address: string },
  actor?: string,
): Promise<Job | null> {
  if (!dbOn()) return null;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/jobs`, {
      method: "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify({ ...input, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Job[];
    const job = rows[0];
    if (job) await logEvent(job.id, "created", input.address, actor);
    return job ?? null;
  } catch {
    return null;
  }
}

export async function updateJob(
  id: string,
  patch: Partial<Job>,
  actor?: string,
): Promise<boolean> {
  if (!dbOn()) return false;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/jobs?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers(), Prefer: "return=minimal" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) return false;
    if (patch.stage) {
      await logEvent(id, "stage", STAGE_LABEL[patch.stage] ?? patch.stage, actor);
    }
    return true;
  } catch {
    return false;
  }
}

/** Counts per stage, for the Today board. */
export async function stageCounts(rep?: string): Promise<Record<string, number>> {
  const jobs = await listJobs({ rep, limit: 1000 });
  const out: Record<string, number> = {};
  for (const j of jobs) out[j.stage] = (out[j.stage] ?? 0) + 1;
  return out;
}

/**
 * The pipeline: how many jobs sit at each stage and what they are worth.
 *
 * Counts alone do not say whether a week was good. Four jobs at "agreement
 * sent" is a different business depending on whether that is $24k or $140k,
 * and the stage that deserves attention is usually the one with the most
 * money sitting still, not the one with the most rows.
 *
 * Value comes from contract_value, which only exists once an agreement has
 * been written. Earlier stages are counted but carry no money, and the board
 * says so rather than printing $0 and implying the work is worthless.
 */
export type StageSlice = {
  stage: Stage;
  label: string;
  count: number;
  value: number;
  /** Jobs at this stage that have no price on them yet. */
  unpriced: number;
};

export async function pipeline(rep?: string) {
  return pipelineOf(await listJobs({ rep, limit: 1000 }));
}

/**
 * The pipeline over a given set of jobs.
 *
 * Today called pipeline() with no filter for everyone, so a setter opening
 * their own page saw the company's revenue, "$20,000 at stake, $20,000 won",
 * and a stage tracker full of jobs that were not theirs, directly above a list
 * saying they had none. Pass the jobs a person is allowed to see.
 */
export function pipelineOf(jobs: Job[]): {
  slices: StageSlice[];
  openValue: number;
  openCount: number;
  wonValue: number;
} {
  const num = (v: unknown) => {
    const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const order: Stage[] = [...STAGES];
  const slices: StageSlice[] = order.map((stage) => {
    const at = jobs.filter((j) => j.stage === stage);
    return {
      stage,
      label: STAGE_LABEL[stage] ?? stage,
      count: at.length,
      value: at.reduce((n, j) => n + num(j.contract_value), 0),
      unpriced: at.filter((j) => num(j.contract_value) === 0).length,
    };
  });

  // "At stake" is work that could still be won or lost. Complete is money
  // already earned and lost is gone, so neither belongs in that number.
  const openStages: Stage[] = [
    "new",
    "contacted",
    "inspection_booked",
    "inspected",
    "agreement_sent",
  ];
  const open = jobs.filter((j) => openStages.includes(j.stage as Stage));
  const won = jobs.filter((j) => j.stage === "signed" || j.stage === "in_production" || j.stage === "complete");

  return {
    slices,
    openCount: open.length,
    openValue: open.reduce((n, j) => n + num(j.contract_value), 0),
    wonValue: won.reduce((n, j) => n + num(j.contract_value), 0),
  };
}
