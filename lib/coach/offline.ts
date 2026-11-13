import type { Persona } from "./personas";
import type { Score, Turn } from "./ai";

/**
 * DEV ONLY. Stand-ins for Claude when this machine has no ANTHROPIC_API_KEY,
 * so the Coach screens can be clicked through locally. Production never uses
 * these (see offline() in ./ai). Every reply says it's offline.
 */

const LINES: Record<string, string[]> = {
  open_guarded: ["[guarded] Yeah? Can I help you?"],
  open_curious: ["[curious] Hi there. What's this about?"],
  open_annoyed: ["[annoyed] Did you not see the sign? What do you want?"],
  mid: [
    "[guarded] Okay. And what does that have to do with me?",
    "[curious] Huh. I didn't know hail that big came through here. Is this going to cost me anything?",
    "[warming] Alright, that's fair. When would somebody come out?",
  ],
  close: ["[booked] Saturday morning works. I'll be here."],
  no: ["[leaving] I'm good, thanks. Have a nice day."],
};

export function offlineReply(p: Persona, turns: Turn[]) {
  const repTurns = turns.filter((t) => t.who === "rep");
  const last = repTurns.at(-1)?.text.toLowerCase() ?? "";
  if (repTurns.length <= 1) return LINES[`open_${p.opening}`][0] + " (offline practice)";
  if (/\b(saturday|sunday|monday|tuesday|wednesday|thursday|friday|morning|afternoon|evening)\b/.test(last)) return LINES.close[0];
  if (repTurns.length >= 5) return LINES.no[0];
  return LINES.mid[Math.min(repTurns.length - 2, LINES.mid.length - 1)];
}

/** Rough keyword checks, so the scorecard screen has something to show. */
export function offlineScore(p: Persona, turns: Turn[]): Score {
  const rep = turns.filter((t) => t.who === "rep" && !/^\(.*\)$/.test(t.text)).map((t) => t.text);
  const all = rep.join(" ").toLowerCase();
  const home = turns.filter((t) => t.who === "home").map((t) => t.text).join(" ");
  const booked = /\[booked\]/i.test(home);
  const walked = !!p.sign && turns.length === 1 && /walks past/i.test(turns[0].text);
  const deductible = /(cover|waive|work with|take care of).{0,30}deductible|deductible.{0,30}(cover|waive)/.test(all);
  const licensed = /licensed roofer|state licensed/.test(all);
  const compliance: Score["compliance"] = [];
  if (/deductible/.test(all)) compliance.push({ rule: "Deductible", ok: !deductible, note: deductible ? "Sounded like an offer to help with the deductible." : "Kept the deductible theirs." });
  if (/licens/.test(all)) compliance.push({ rule: "No licensed roofer claim", ok: !licensed, note: licensed ? "Said licensed roofer." : "Didn't claim a license." });
  if (p.sign) compliance.push({ rule: "No Soliciting", ok: !!walked, note: walked ? "Walked past the sign." : "Knocked a No Soliciting door." });
  const fixes = rep.slice(0, 2).map((r) => ({
    you_said: r.slice(0, 160),
    try: "Lead with the hail date and stone size for this street, then ask one question.",
    why: "Offline scoring: no AI key on this machine, so this is a placeholder.",
  }));
  return {
    result: walked ? "walked_past" : booked ? "booked" : /\[leaving\]/i.test(home) ? "door_closed" : "no",
    score: walked ? 100 : Math.max(0, (booked ? 70 : 40) - (deductible ? 30 : 0) - (licensed ? 30 : 0)),
    headline: "Offline scorecard. Add ANTHROPIC_API_KEY to get a real one.",
    did_well: booked ? ["Got to a specific time."] : [],
    fixes,
    compliance,
  };
}
