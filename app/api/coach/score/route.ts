import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { burst, tooMany } from "@/lib/rateLimit";
import {
  COACH_BETAS,
  COACH_MODEL,
  SCORE_SCHEMA,
  ai,
  aiReady,
  cleanTurns,
  houseBrief,
  logUsage,
  notSwitchedOn,
  offline,
  readScene,
  scoreSystem,
  transcriptText,
  type Score,
} from "@/lib/coach/ai";
import { scoringReference } from "@/lib/coach/playbook";
import { offlineScore } from "@/lib/coach/offline";

export const dynamic = "force-dynamic";

/**
 * The scorecard for one practice door, against the knocker door script and
 * the Texas compliance card. Also says who was really at the door.
 *
 *   POST /api/coach/score { scene, turns }
 */
export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const wait = burst(`coach:score:${u.id}`, 15, 10 * 60e3) ?? burst(`coach:day:${u.id}`, 400, 24 * 3600e3);
  if (wait) return tooMany(wait, "Coach needs a short break. Try again in a few minutes.");

  let body: { scene?: unknown; turns?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const scene = readScene(body.scene);
  const turns = cleanTurns(body.turns);
  if (!scene || !turns?.length) return NextResponse.json({ ok: false, error: "Nothing to score yet." }, { status: 400 });
  const who = { id: scene.p.id, label: scene.p.label, name: scene.p.name };

  if (!aiReady()) {
    if (!offline()) return notSwitchedOn();
    return NextResponse.json({ ok: true, score: offlineScore(scene.p, turns), homeowner: who, offline: true });
  }

  try {
    const reference = await scoringReference();
    const prompt = `The door:
${houseBrief(scene.house)}
${scene.p.sign ? "A No Soliciting sign was on the door." : ""}
Who was really at the door: ${scene.p.label}. ${scene.p.brief}
${scene.p.notOwner ? "This person is not the owner of the home." : ""}

The practice conversation ("(knocks on the door)" means the rep knocked; "(walks past)" means the rep chose not to knock):
${transcriptText(turns, scene.p)}

Score the rep.`;

    const res = await ai().beta.messages.create({
      model: COACH_MODEL,
      max_tokens: 8000,
      betas: COACH_BETAS,
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCORE_SCHEMA } },
      system: [{ type: "text", text: scoreSystem(reference), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: prompt }],
    });
    logUsage("score", u.id, res.usage);
    if (res.stop_reason === "refusal") {
      return NextResponse.json({ ok: false, error: "Coach couldn't score that one. Try another door." }, { status: 422 });
    }
    const text = res.content.find((b) => b.type === "text");
    const score = text && text.type === "text" ? (JSON.parse(text.text) as Score) : null;
    if (!score) throw new Error("no score");
    score.score = Math.max(0, Math.min(100, Math.round(score.score)));
    return NextResponse.json({ ok: true, score, homeowner: who });
  } catch (err) {
    console.error("[coach/score]", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
    return NextResponse.json({ ok: false, error: "Couldn't score that. Try again." }, { status: 502 });
  }
}
