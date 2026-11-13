import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { burst, tooMany } from "@/lib/rateLimit";
import {
  COACH_BETAS,
  COACH_MODEL,
  ai,
  aiReady,
  cleanTurns,
  logUsage,
  notSwitchedOn,
  offline,
  practiceSystem,
  readScene,
} from "@/lib/coach/ai";
import { offlineReply } from "@/lib/coach/offline";

export const dynamic = "force-dynamic";

/**
 * The homeowner's next line, streamed as plain text so the phone can start
 * speaking it before it's finished. The first thing in the text is a mood tag
 * ([guarded], [warming], ...) the screen uses to draw the door.
 *
 *   POST /api/coach/practice { scene, turns: [{ who: "rep" | "home", text }] }
 */
export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const wait = burst(`coach:turn:${u.id}`, 60, 10 * 60e3) ?? burst(`coach:day:${u.id}`, 400, 24 * 3600e3);
  if (wait) return tooMany(wait, "Coach needs a short break. Try again in a few minutes.");

  let body: { scene?: unknown; turns?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const scene = readScene(body.scene);
  const turns = cleanTurns(body.turns);
  if (!scene || !turns?.length || turns.at(-1)!.who !== "rep") {
    return NextResponse.json({ ok: false, error: "Start the door again." }, { status: 400 });
  }

  if (!aiReady()) {
    if (!offline()) return notSwitchedOn();
    return new Response(offlineReply(scene.p, turns), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // Rep lines are the user turns; the homeowner's are Claude's.
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t) => ({
    role: t.who === "rep" ? "user" : "assistant",
    content: t.text,
  }));
  if (messages[0].role !== "user") messages.shift();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const s = ai().beta.messages.stream({
          model: COACH_MODEL,
          // Room for brief thinking plus a one-to-three sentence line.
          max_tokens: 3000,
          betas: COACH_BETAS,
          fallbacks: "default",
          // Low effort: a door is a quick back-and-forth, and the rep is waiting to hear it.
          output_config: { effort: "low" },
          system: [{ type: "text", text: practiceSystem(scene), cache_control: { type: "ephemeral" } }],
          messages,
        });
        s.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n[leaving] Sorry, I have to go."));
        logUsage("practice", u.id, final.usage);
      } catch (err) {
        console.error("[coach/practice]", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
        controller.enqueue(encoder.encode("\n[[error]]"));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
