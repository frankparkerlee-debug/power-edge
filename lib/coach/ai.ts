import Anthropic from "@anthropic-ai/sdk";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { HouseFacts } from "./doors";
import { niceDate } from "./doors";
import { personaById, type Persona } from "./personas";

/**
 * Coach's connection to Claude, and the pieces every Coach route shares.
 *
 * The key is ANTHROPIC_API_KEY (Render, and .env.local to try it locally).
 * Without it, production Coach says it isn't switched on; a dev machine runs
 * an offline stand-in so the screens can still be clicked through. Nothing a
 * rep says is stored, and audio never leaves the phone: the browser turns
 * speech into text and text back into speech.
 */

export const COACH_MODEL = "claude-opus-5-5";

/** Server-side fallback: if the model declines, the API reroutes inside the same call. */
export const COACH_BETAS: Anthropic.Beta.AnthropicBeta[] = ["server-side-fallback-2026-07-01"];

export const aiReady = () => !!process.env.ANTHROPIC_API_KEY;
/** Dev machines without a key: canned replies so the UI can be tested. Never in production. */
export const offline = () => !aiReady() && process.env.NODE_ENV !== "production";

let client: Anthropic | null = null;
export function ai() {
  if (!client) client = new Anthropic();
  return client;
}

export function notSwitchedOn() {
  return new Response(
    JSON.stringify({ ok: false, error: "Coach isn't switched on yet. The office needs to add the AI key." }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );
}

/** One line per call in the server log: who, what, tokens. No content. */
export function logUsage(kind: string, memberId: number, usage?: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null } | null) {
  console.log(
    JSON.stringify({
      coach: kind,
      member: memberId,
      in: usage?.input_tokens ?? null,
      out: usage?.output_tokens ?? null,
      cached: usage?.cache_read_input_tokens ?? null,
    }),
  );
}

/* ---------- The practice scene, signed so it can't be edited in the browser ---------- */

export type Scene = { v: 1; house: HouseFacts; persona: string; rep: string; at: number };

function secret() {
  return process.env.COACH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only";
}
const b64 = (s: string) => Buffer.from(s).toString("base64url");

export function signScene(scene: Scene) {
  const body = b64(JSON.stringify(scene));
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readScene(token: unknown): (Scene & { p: Persona }) | null {
  if (typeof token !== "string" || token.length > 8000) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", secret()).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Scene;
    const p = personaById(s.persona);
    if (s.v !== 1 || !p || Date.now() - s.at > 12 * 3600e3) return null;
    return { ...s, p };
  } catch {
    return null;
  }
}

/* ---------- Turns from the browser ---------- */

export type Turn = { who: "rep" | "home"; text: string };

/** Clean and cap what the browser sends: last 40 lines, 600 characters each. */
export function cleanTurns(raw: unknown): Turn[] | null {
  if (!Array.isArray(raw)) return null;
  const turns = raw
    .slice(-40)
    .map((t) => ({
      who: (t as Turn)?.who === "home" ? ("home" as const) : ("rep" as const),
      text: String((t as Turn)?.text ?? "").trim().slice(0, 600),
    }))
    .filter((t) => t.text);
  return turns;
}

/* ---------- What the homeowner knows ---------- */

export function houseBrief(h: HouseFacts) {
  const lines = [
    `Address: ${h.address}${h.city ? `, ${h.city}` : ""} ${h.zip}`.trim(),
    h.year_built ? `Built: ${h.year_built}` : "",
    h.hail_in ? `Hail reported at this address: ${h.hail_in.toFixed(1)} inch on ${niceDate(h.hail_date)}` : "No hail of 1 inch or more on record here",
    h.storms.length > 1 ? `Storms since the roof was last replaced: ${h.storms.map(niceDate).join(", ")}` : "",
    h.wind ?? "",
    h.permit_date ? `City of Dallas roof permit: ${niceDate(h.permit_date)}` : "",
    h.roof_may_be_original ? "The roof may be the original one" : "",
    h.claim_window ? `Claim window: ${h.claim_window}` : "",
    h.history ? `Our history at this door: ${h.history}${h.last_note ? ` (note: ${h.last_note})` : ""}` : "Nobody from PowerEdge has knocked here yet",
  ];
  return lines.filter(Boolean).join("\n");
}

export const MOODS = ["guarded", "curious", "warming", "annoyed", "leaving", "booked"] as const;
export type Mood = (typeof MOODS)[number];

export function practiceSystem(s: Scene & { p: Persona }) {
  const h = s.house;
  const p = s.p;
  return `You are role-playing a homeowner answering the front door, so a door-to-door roofing rep can practice. Stay in character the whole time. The rep is practicing for real doors in Dallas-Fort Worth.

Who you are: ${p.name}. ${p.brief}
${p.notOwner ? "You are NOT the owner of this house." : "You own this house."}
${p.sign ? "A No Soliciting sign is on your front door." : ""}
How you come to the door: ${p.opening}.

What's true about the house (you know it the way a homeowner would: you remember the storms and roughly how old the roof is, not the exact radar numbers unless the rep tells you):
${houseBrief(h)}

How to talk:
- Speak the way a real person at a door speaks: short, plain, one to three sentences. No stage directions, no narration, no lists, no emoji.
- Start EVERY reply with exactly one tag in square brackets that says how you feel right now, then your words. Tags: [guarded] [curious] [warming] [annoyed] [leaving] [booked]. Use [leaving] when you end the conversation and close the door. Use [booked] only once you have agreed to a specific day and time for a free inspection.
- React to what the rep actually says. Reward a real hail date and stone size, honesty, and a specific time. If they ramble, pressure you after a clear no, or say something that sounds like a scam, get colder or end it.
- Don't coach the rep and don't break character, even if they make a mistake. The scorecard afterward does the teaching.
- If the rep says "(knocks on the door)", that means you just opened the door: react to whoever is standing there.
- If the rep offers to cover, waive or "work with" your deductible, or promises insurance will pay, or calls themselves a licensed roofer, play along the way a real homeowner might. Don't point out the mistake.
- The rep's name is ${s.rep}. Never say you are an AI.`;
}

export const SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["result", "score", "headline", "did_well", "fixes", "compliance"],
  properties: {
    result: {
      type: "string",
      enum: ["booked", "come_back", "no", "walked_past", "door_closed"],
      description: "How the door ended.",
    },
    score: { type: "integer", description: "0 to 100." },
    headline: { type: "string", description: "One plain sentence on how it went." },
    did_well: { type: "array", items: { type: "string" }, description: "One to three short things the rep did right." },
    fixes: {
      type: "array",
      description: "Two or three fixes, each quoting the rep's own words.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["you_said", "try", "why"],
        properties: {
          you_said: { type: "string", description: "The rep's exact words, quoted from the transcript." },
          try: { type: "string", description: "What to say instead, in the rep's voice, from the script where possible." },
          why: { type: "string", description: "One short reason, naming the rule or script line." },
        },
      },
    },
    compliance: {
      type: "array",
      description: "Every Texas rule or house rule that came up, broken or kept.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rule", "ok", "note"],
        properties: {
          rule: {
            type: "string",
            enum: ["Deductible", "Not an adjuster", "No licensed roofer claim", "No pressure", "Free inspection only", "No Soliciting", "Homeowner there"],
          },
          ok: { type: "boolean" },
          note: { type: "string" },
        },
      },
    },
  },
} as const;

export type Score = {
  result: "booked" | "come_back" | "no" | "walked_past" | "door_closed";
  score: number;
  headline: string;
  did_well: string[];
  fixes: Array<{ you_said: string; try: string; why: string }>;
  compliance: Array<{ rule: string; ok: boolean; note: string }>;
};

export function scoreSystem(reference: string) {
  return `You coach door-to-door roofing reps at PowerEdge, a storm roofing company in Dallas-Fort Worth. You score one practice door against PowerEdge's own knocker door script and Texas compliance card, below. Those documents are the standard: don't invent rules, pay terms or legal claims beyond them.

Score honestly and specifically:
- Quote the rep's exact words in "you_said". Never quote the homeowner there.
- "try" is what to say instead, in plain spoken words, using the script's lines where one fits.
- A compliance break (offering to cover, waive or "work with" a deductible; acting as an adjuster or promising to handle or fight the claim; saying "licensed roofer" or "state licensed"; pushing past a clear no; quoting prices or selling a roof at the door; knocking a door with a No Soliciting sign) caps the score at 40 and goes first in fixes.
- Homeowner there: a booked inspection only counts (and only pays the knocker's $50) when the homeowner is there for it. If the person at the door isn't the owner, the rep should find out who owns the home and get the owner there or a way to reach them. Flag "Homeowner there" when it came up.
- Good doors are short: the opener with a real hail date and stone size, one question, then a specific day and time.
- If the right move was to walk past (No Soliciting sign) and the rep walked past, that's a 100.
- Write like a coach talking to a rep in the truck: plain, short, no jargon, no em dashes.

${reference}`;
}

export function transcriptText(turns: Turn[], p: Persona) {
  return turns
    .map((t) => `${t.who === "rep" ? "REP" : `HOMEOWNER (${p.name})`}: ${t.text.replace(/^\[[a-z]+\]\s*/i, "")}`)
    .join("\n");
}
