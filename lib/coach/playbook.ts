import { readFile } from "node:fs/promises";
import path from "node:path";
import { QUIZ } from "@/lib/onboardingQuiz";

/**
 * The playbook, as Coach reads it.
 *
 * The same HTML files the reps get as PDFs (print/sales), cut into sections
 * at each <h2>, plus the compliance check with its answers. Coach answers
 * only from these, and names the document, so a rep can open the PDF and see
 * the line for themselves. If the docs change, Coach changes with them on
 * the next deploy: there is no second copy to keep in sync.
 */

export type DocId =
  | "01" | "02" | "03" | "04" | "05" | "06"
  | "07" | "08" | "09" | "10" | "11" | "12" | "quiz";

/** File and the name reps know it by (the same names /sales lists). */
export const DOCS: Record<DocId, { file?: string; name: string }> = {
  "01": { file: "01-setter-script.html", name: "Phone setter script" },
  "02": { file: "02-closer-script.html", name: "Closer field script" },
  "03": { file: "03-texas-compliance-card.html", name: "Texas compliance card" },
  "04": { file: "04-territory-board.html", name: "Storm territory board" },
  "05": { file: "05-claim-intake-form.html", name: "Insurance claim intake" },
  "06": { file: "06-inspection-report.html", name: "Roof inspection report" },
  "07": { file: "07-homeowner-leave-behind.html", name: "How a roof claim works" },
  "08": { file: "08-repair-agreement.html", name: "Residential repair agreement" },
  "09": { file: "09-knocker-door-script.html", name: "Knocker door script" },
  "10": { file: "10-using-the-app.html", name: "Using the app" },
  "11": { file: "11-how-you-get-paid.html", name: "How you get paid" },
  "12": { file: "12-closer-field-guide.html", name: "Closer field guide" },
  quiz: { name: "Compliance check" },
};

export const DOC_IDS = Object.keys(DOCS) as DocId[];

export type Section = { doc: DocId; docName: string; title: string; text: string };

const DIR = path.join(process.cwd(), "print", "sales");

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'",
  ldquo: '"', rdquo: '"', mdash: ", ", ndash: "-", middot: "·", hellip: "...", times: "x",
  minus: "-", bull: "·", deg: "°", Prime: "″", prime: "′", rarr: "->", larr: "<-",
};

function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => ENTITIES[n] ?? m);
}

/** HTML fragment to readable text: rows as "a | b", list items as "- x". */
function toText(html: string) {
  return decode(
    html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(td|th)>\s*<(td|th)[^>]*>/gi, " | ")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|tr|li|h1|h2|h3|ul|ol|table|header|footer)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sectionsOf(doc: DocId, html: string): Section[] {
  const docName = DOCS[doc].name;
  const body = html.replace(/<header class="doc">[\s\S]*?<\/header>/i, "").replace(/<footer[\s\S]*?<\/footer>/i, "");
  const parts = body.split(/<h2[^>]*>/i);
  const out: Section[] = [];
  // Before the first h2: the headline and intro.
  const intro = toText(parts[0]);
  if (intro) {
    const h1 = parts[0].match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    out.push({ doc, docName, title: h1 ? toText(h1[1]) : "Overview", text: intro });
  }
  for (const p of parts.slice(1)) {
    const [rawTitle, ...rest] = p.split(/<\/h2>/i);
    const text = toText(rest.join(" "));
    if (text) out.push({ doc, docName, title: toText(rawTitle), text });
  }
  return out;
}

function quizSections(): Section[] {
  return QUIZ.map((q) => ({
    doc: "quiz" as DocId,
    docName: DOCS.quiz.name,
    title: q.q,
    text: `Question: ${q.q}\nRight answer: ${q.choices[q.answer]}\nWhy: ${q.why}`,
  }));
}

let cache: { at: number; sections: Section[] } | null = null;

export async function loadPlaybook(): Promise<Section[]> {
  if (cache && Date.now() - cache.at < 10 * 60e3) return cache.sections;
  const sections: Section[] = [];
  for (const id of DOC_IDS) {
    const file = DOCS[id].file;
    if (!file) continue;
    try {
      const html = await readFile(path.join(DIR, file), "utf8");
      sections.push(...sectionsOf(id, html));
    } catch {
      /* a missing doc is skipped, not fatal */
    }
  }
  sections.push(...quizSections());
  cache = { at: Date.now(), sections };
  return sections;
}

const STOP = new Set(
  "a an and are as at be but by can do does for from has have how i if in into is it its me my no not of on or our so that the their them then there they this to was we what when where which who why will with you your".split(" "),
);

function stem(w: string) {
  return w.replace(/(ing|ed|es|s)$/, "");
}
function terms(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9$%\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

/**
 * Keyword search over sections, weighted by how rare each word is. Simple on
 * purpose: the agent searches again with other words when the first try
 * misses, and reads the whole doc when it needs more.
 */
export async function searchPlaybook(query: string, k = 4) {
  const sections = await loadPlaybook();
  const q = [...new Set(terms(query))];
  if (!q.length) return [];
  const docs = sections.map((s) => {
    const body = terms(s.text);
    const title = terms(`${s.title} ${s.docName}`);
    return { s, body, title };
  });
  const df = new Map<string, number>();
  for (const t of q) df.set(t, docs.filter((d) => d.body.includes(t) || d.title.includes(t)).length);
  const N = docs.length;
  const scored = docs
    .map((d) => {
      let score = 0;
      for (const t of q) {
        const n = df.get(t) || 0;
        if (!n) continue;
        const idf = Math.log(1 + N / n);
        const tf = d.body.filter((w) => w === t).length;
        const inTitle = d.title.includes(t) ? 2 : 0;
        score += idf * (Math.min(tf, 4) + inTitle);
      }
      return { ...d.s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  return scored.map(({ doc, docName, title, text }) => ({ doc, docName, title, text: text.slice(0, 2400) }));
}

/** One whole document, for when a section isn't enough. */
export async function readPlaybookDoc(doc: DocId) {
  const sections = (await loadPlaybook()).filter((s) => s.doc === doc);
  if (!sections.length) return null;
  const text = sections.map((s) => `## ${s.title}\n${s.text}`).join("\n\n");
  return { doc, docName: DOCS[doc].name, text: text.slice(0, 16000) };
}

/** The door script and compliance card, whole: what practice is scored against. */
export async function scoringReference() {
  const [door, card] = await Promise.all([readPlaybookDoc("09"), readPlaybookDoc("03")]);
  return [door, card].filter(Boolean).map((d) => `# ${d!.docName}\n${d!.text}`).join("\n\n");
}
