// Render one print piece with Chrome, waiting for its fonts first.
//
//   node render.mjs <page.html> pdf <out.pdf>
//   node render.mjs <page.html> png <out.png> <cssWidth> <cssHeight> <scale>
//
// Chrome's own --print-to-pdf and --screenshot flags capture as soon as the
// page loads, which was before the web fonts were applied: the door hanger
// headline came out in a fallback face. This drives Chrome over the DevTools
// protocol instead, so it can wait on document.fonts before capturing.
// Uses only Node built-ins (Node 22+ for the global WebSocket).
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [, , page, mode, out, w, h, scale] = process.argv;
if (!page || !["pdf", "png"].includes(mode) || !out) {
  console.error("usage: node render.mjs <page.html> pdf|png <out> [w h scale]");
  process.exit(2);
}

const profile = mkdtempSync(join(tmpdir(), "pe-render-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
]);

const wsUrl = await new Promise((ok, fail) => {
  let buf = "";
  const t = setTimeout(() => fail(new Error("Chrome did not start")), 15000);
  chrome.stderr.on("data", (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) { clearTimeout(t); ok(m[1]); }
  });
});

const ws = new WebSocket(wsUrl);
await new Promise((ok) => ws.addEventListener("open", ok, { once: true }));
let seq = 0;
const pending = new Map();
const waiters = [];
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { ok, fail } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? fail(new Error(JSON.stringify(msg.error))) : ok(msg.result);
  } else if (msg.method) {
    for (const wtr of [...waiters]) if (wtr.method === msg.method) { waiters.splice(waiters.indexOf(wtr), 1); wtr.ok(msg.params); }
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((ok, fail) => {
    const id = ++seq;
    pending.set(id, { ok, fail });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
const once = (method) => new Promise((ok) => waiters.push({ method, ok }));

try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s("Page.enable");
  if (mode === "png") {
    await s("Emulation.setDeviceMetricsOverride", {
      width: Number(w), height: Number(h), deviceScaleFactor: Number(scale), mobile: false,
    });
  }
  const loaded = once("Page.loadEventFired");
  await s("Page.navigate", { url: pathToFileURL(resolve(page)).href });
  await loaded;
  const fonts = await s("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      await Promise.all(['900 40px "Archivo"', '400 20px "Inter"', '700 20px "Inter"', '700 20px "JetBrains Mono"']
        .map((f) => document.fonts.load(f)));
      await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return [...document.fonts].map((f) => f.family + ' ' + f.status);
    })()`,
  });
  const states = fonts.result.value || [];
  if (states.some((x) => !x.endsWith("loaded"))) throw new Error("fonts not loaded: " + states.join(", "));

  if (mode === "pdf") {
    const { data } = await s("Page.printToPDF", { preferCSSPageSize: true, printBackground: true });
    writeFileSync(out, Buffer.from(data, "base64"));
  } else {
    const { data } = await s("Page.captureScreenshot", { format: "png" });
    writeFileSync(out, Buffer.from(data, "base64"));
  }
} finally {
  ws.close();
  chrome.kill();
  setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch {} }, 500);
}
