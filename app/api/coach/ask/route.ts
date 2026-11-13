import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { burst, tooMany } from "@/lib/rateLimit";
import { COACH_BETAS, COACH_MODEL, ai, aiReady, logUsage, notSwitchedOn, offline } from "@/lib/coach/ai";
import { DOCS, DOC_IDS, readPlaybookDoc, searchPlaybook, type DocId } from "@/lib/coach/playbook";
import { bestStreets, houseByAddress, inDfw, niceDate } from "@/lib/coach/doors";

export const dynamic = "force-dynamic";

/**
 * Ask Coach: the agent behind the Ask and Find doors tabs.
 *
 * It answers from our own playbook (searching it, then reading a whole doc
 * when a section isn't enough) and from our storm data (best streets near the
 * rep, or one house). It streams newline-delimited JSON so the screen can show
 * each search as it happens, then the answer as it's written:
 *
 *   { t: "step", d }      what it's looking up
 *   { t: "text", d }      a piece of the answer
 *   { t: "streets", ... } street cards (find_doors)
 *   { t: "house", house } a house card (look_up_house)
 *   { t: "done" } | { t: "error", d }
 *
 *   POST /api/coach/ask { messages: [{ role: "user" | "assistant", text }], here?: { lat, lon } }
 */

const SYSTEM = `You are Coach, the sales assistant inside the PowerEdge app. PowerEdge is a storm roofing company in Dallas-Fort Worth. Knockers book free roof inspections at the door; closers run the inspections and sign the work. You help them on their phones, often standing in a driveway.

Where your answers come from:
- Policy, scripts, compliance, pay, how the app works: ONLY PowerEdge's playbook. Search it with search_playbook (try other words if the first search misses) and read a whole document with read_playbook_doc when a section isn't enough. Say which document the answer came from, by name, at the end: "From: Knocker door script".
- Where to knock: find_doors. A specific house: look_up_house.
- If the playbook doesn't cover it, say so plainly and tell them to call or text the office at 469-277-9594. Never invent policy, pay terms, legal rules or promises. Never guess at the law.

How to answer:
- Short. A rep is reading this on a phone. Lead with the answer or the exact words to say at the door, then one line of why if it helps. Use the script's own lines when there is one.
- Plain, natural spoken English, American spelling. No em dashes. No markdown headings or tables; short bullets only when listing streets or steps.
- Hail is "reported" at an address, never say it "hit" a house. Never call PowerEdge a licensed roofer (Texas doesn't license roofers). Never suggest covering, waiving or working with a deductible.
- Don't volunteer company costs or margins. If a rep asks how their own pay is worked out, answer from How you get paid.
- For find_doors results, give the top three streets with the reason for each in one line, and tell them the cards below open the map. Don't repeat every number.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_playbook",
    description:
      "Search PowerEdge's playbook (door and phone scripts, Texas compliance card, closer field guide, how pay works, using the app, the repair agreement, the compliance quiz). Returns the best-matching sections with their document names. Use plain keywords, e.g. 'deductible financing' or 'adjuster claim'.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Keywords to search for." } },
      required: ["query"],
    },
    eager_input_streaming: true,
  },
  {
    name: "read_playbook_doc",
    description: `Read one whole playbook document. Documents: ${DOC_IDS.map((d) => `${d} = ${DOCS[d].name}`).join("; ")}.`,
    input_schema: {
      type: "object",
      properties: { doc: { type: "string", enum: DOC_IDS, description: "Document id." } },
      required: ["doc"],
    },
    eager_input_streaming: true,
  },
  {
    name: "find_doors",
    description:
      "Find the best streets to knock today from PowerEdge's storm data, using the knock map's priority rule (old roof or repeat storms, with a storm inside the 1-year claim window), falling back to the biggest reported hail. 'where' is 'near me' (uses the rep's location if they shared it) or a 5-digit ZIP.",
    input_schema: {
      type: "object",
      properties: { where: { type: "string", description: "'near me' or a 5-digit ZIP code." } },
      required: ["where"],
    },
    eager_input_streaming: true,
  },
  {
    name: "look_up_house",
    description:
      "Look up one house in PowerEdge's storm data by street address: hail reported there and when, storms since the roof, Dallas roof permits, whether the roof may be original, the claim window, and whether we've knocked it.",
    input_schema: {
      type: "object",
      properties: { address: { type: "string", description: "Street address, with city or ZIP if known." } },
      required: ["address"],
    },
    eager_input_streaming: true,
  },
];

type Emit = (o: Record<string, unknown>) => void;
type Here = { lat: number; lon: number } | null;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Run one tool. Inputs are untrusted model output: check them before use. */
async function runTool(name: string, input: unknown, here: Here, emit: Emit): Promise<{ content: string; is_error?: boolean }> {
  const i = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "search_playbook": {
      const q = str(i.query).slice(0, 200);
      if (!q) return { content: "INVALID_INPUT: query is required", is_error: true };
      emit({ t: "step", d: `Searching the playbook: ${q}` });
      const hits = await searchPlaybook(q);
      if (!hits.length) return { content: "No matching sections. Try other words, or read a whole document." };
      return { content: hits.map((h) => `[${h.docName} › ${h.title}]\n${h.text}`).join("\n\n---\n\n") };
    }
    case "read_playbook_doc": {
      const d = str(i.doc) as DocId;
      if (!DOC_IDS.includes(d)) return { content: "INVALID_INPUT: unknown doc id", is_error: true };
      emit({ t: "step", d: `Reading ${DOCS[d].name}` });
      const doc = await readPlaybookDoc(d);
      return doc ? { content: `[${doc.docName}]\n${doc.text}` } : { content: "That document isn't available.", is_error: true };
    }
    case "find_doors": {
      const w = str(i.where).toLowerCase();
      const zip = w.match(/\b\d{5}\b/)?.[0];
      if (!zip && !here) {
        return { content: "The rep hasn't shared a location. Ask them for a ZIP code, or to tap Use my location." };
      }
      emit({ t: "step", d: zip ? `Looking for streets in ${zip}` : "Looking for streets near you" });
      const r = await bestStreets(zip ? { zip } : here!);
      if (!r.ok) return { content: r.error, is_error: true };
      emit({ t: "streets", streets: r.streets, basis: r.basis, where: zip ?? "near you" });
      if (!r.streets.length) return { content: "No open doors with storm signals there. Suggest another ZIP or the knock map's Older roofs view." };
      return {
        content:
          `Ranked by ${r.basis === "priority" ? "the knock map's priority rule" : "biggest reported hail (no priority doors there)"}:\n` +
          r.streets.map((s, n) => `${n + 1}. ${s.street}${s.city ? `, ${s.city}` : ""} ${s.zip}: ${s.why}`).join("\n"),
      };
    }
    case "look_up_house": {
      const a = str(i.address).slice(0, 160);
      if (!a) return { content: "INVALID_INPUT: address is required", is_error: true };
      emit({ t: "step", d: `Looking up ${a}` });
      const h = await houseByAddress(a);
      if (!h) return { content: "Not in our storm data (outside DFW, or the address didn't match). Ask for the full address with the city." };
      emit({ t: "house", house: h });
      return {
        content: [
          `${h.address}${h.city ? `, ${h.city}` : ""} ${h.zip}`,
          h.year_built ? `Built ${h.year_built}` : "",
          h.hail_in ? `${h.hail_in.toFixed(1)} inch hail reported ${niceDate(h.hail_date)}` : "No hail of 1 inch or more on record",
          h.storms.length > 1 ? `Storms since the roof: ${h.storms.map(niceDate).join(", ")}` : "",
          h.wind ?? "",
          h.permit_date ? `Dallas roof permit ${niceDate(h.permit_date)}${h.recent_permit ? " (recent: likely already replaced)" : ""}` : "",
          h.roof_may_be_original ? "Roof may be original" : "",
          h.priority ? "Priority door" : "",
          h.claim_window ? `Claim window: ${h.claim_window}` : "",
          h.history ?? "Not knocked yet",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }
    default:
      return { content: `Unknown tool ${name}`, is_error: true };
  }
}

/** DEV ONLY: no key on this machine. Runs the real tools, no model. */
async function offlineAsk(q: string, here: Here, emit: Emit) {
  const zip = q.match(/\b\d{5}\b/)?.[0];
  if (/\b(door|doors|street|streets|knock|where)\b/i.test(q) || zip) {
    const r = await runTool("find_doors", { where: zip ?? "near me" }, here, emit);
    emit({ t: "text", d: `Offline (no AI key on this machine). ${r.content}` });
    return;
  }
  const r = await runTool("search_playbook", { query: q }, here, emit);
  emit({ t: "text", d: `Offline (no AI key on this machine). Closest playbook section:\n\n${r.content.slice(0, 900)}` });
}

export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const wait = burst(`coach:ask:${u.id}`, 30, 10 * 60e3) ?? burst(`coach:day:${u.id}`, 400, 24 * 3600e3);
  if (wait) return tooMany(wait, "Coach needs a short break. Try again in a few minutes.");

  let body: { messages?: unknown; here?: { lat?: number; lon?: number } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-16)
    .map((m) => ({
      role: (m as { role?: string })?.role === "assistant" ? ("assistant" as const) : ("user" as const),
      text: String((m as { text?: unknown })?.text ?? "").trim().slice(0, 2000),
    }))
    .filter((m) => m.text);
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length || history.at(-1)!.role !== "user") {
    return NextResponse.json({ ok: false, error: "Ask a question." }, { status: 400 });
  }
  const lat = Number(body.here?.lat), lon = Number(body.here?.lon);
  const here: Here = Number.isFinite(lat) && Number.isFinite(lon) && inDfw(lat, lon) ? { lat, lon } : null;

  if (!aiReady() && !offline()) return notSwitchedOn();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = (o) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      try {
        if (!aiReady()) {
          await offlineAsk(history.at(-1)!.text, here, emit);
          emit({ t: "done" });
          return;
        }

        const context = `Today is ${new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", year: "numeric" })}. You're helping ${u.name.split(" ")[0]} (${u.role === "setter" ? "a knocker" : u.role === "admin" ? "the office" : "a closer"}). ${here ? "They shared their location, so find_doors can use 'near me'." : "They haven't shared a location; for find_doors, ask for a ZIP or to tap Use my location."}`;
        const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.text }));
        const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 };

        for (let step = 0; step < 8; step++) {
          const s = ai().beta.messages.stream({
            model: COACH_MODEL,
            max_tokens: 16000,
            betas: COACH_BETAS,
            fallbacks: "default",
            output_config: { effort: "medium" },
            system: [
              { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
              { type: "text", text: context },
            ],
            tools: TOOLS,
            messages,
          });
          s.on("text", (d) => emit({ t: "text", d }));
          let msg: Anthropic.Beta.BetaMessage;
          try {
            msg = await s.finalMessage();
          } catch (err) {
            // A tool input that wasn't parseable JSON: retry the turn once; API errors go up.
            if (err instanceof Anthropic.APIError || step >= 2) throw err;
            continue;
          }
          usage.input_tokens += msg.usage.input_tokens ?? 0;
          usage.output_tokens += msg.usage.output_tokens ?? 0;
          usage.cache_read_input_tokens += msg.usage.cache_read_input_tokens ?? 0;

          if (msg.stop_reason === "refusal") {
            emit({ t: "error", d: "Coach can't help with that one. Call the office at 469-277-9594." });
            break;
          }
          const calls = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
          if (msg.stop_reason !== "tool_use" || !calls.length) break;

          messages.push({ role: "assistant", content: msg.content });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const c of calls) {
            try {
              const r = await runTool(c.name, c.input, here, emit);
              results.push({ type: "tool_result", tool_use_id: c.id, content: r.content, ...(r.is_error ? { is_error: true } : {}) });
            } catch (err) {
              console.error("[coach/ask] tool", c.name, err);
              results.push({ type: "tool_result", tool_use_id: c.id, content: "That lookup failed. Try again or answer without it.", is_error: true });
            }
          }
          messages.push({ role: "user", content: results });
          emit({ t: "text", d: "\n\n" });
        }
        logUsage("ask", u.id, usage);
        emit({ t: "done" });
      } catch (err) {
        console.error("[coach/ask]", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
        emit({ t: "error", d: "Coach couldn't answer just now. Try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
