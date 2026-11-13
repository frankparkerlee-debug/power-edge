import type { Member } from "@/lib/auth";
import { loadOnboarding, stepsFor, type Step } from "@/lib/onboarding";

/**
 * Can this person work doors yet?
 *
 * Parker 11/12: "Reps can knock before we get permits, not before they finish
 * onboarding." So the rep's own Getting started steps gate the field (details
 * and badge photo, the signed agreement, W-9, direct deposit, the playbook and
 * compliance check). City permits don't: they can take weeks. The office
 * steps (ride-along, gear) don't either, since the ride-along is itself a day
 * of knocking.
 *
 * Gated: logging a door, adding a door to the list, booking an inspection.
 * Not gated: looking at the map, the playbook, Coach. Admins are never gated.
 */
const GATE: Step["key"][] = ["profile", "agreement", "w9", "bank", "training"];

/** The same rule on steps already loaded (the office board). */
export function canKnock(steps: Step[]) {
  return steps.every((s) => !GATE.includes(s.key) || s.done);
}

export async function fieldReady(u: Pick<Member, "id" | "role">): Promise<{ ready: boolean; missing: string[] }> {
  if (u.role === "admin") return { ready: true, missing: [] };
  try {
    const steps = stepsFor(await loadOnboarding(u.id));
    const missing = steps.filter((s) => GATE.includes(s.key) && !s.done).map((s) => s.label);
    return { ready: missing.length === 0, missing };
  } catch {
    // If onboarding can't be read, don't strand a rep at a door.
    return { ready: true, missing: [] };
  }
}

/** The one sentence every gated action returns. */
export function notReadyMessage(missing: string[]) {
  return `Finish Getting started before you knock: ${missing.join(", ").toLowerCase()}. Tap your initial at the top right, then Getting started.`;
}
