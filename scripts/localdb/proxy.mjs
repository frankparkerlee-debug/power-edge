// Supabase serves PostgREST under /rest/v1; plain PostgREST serves it at /.
// This maps one onto the other so the app's SUPABASE_URL calls work locally.
// It also stands in for Supabase Storage (/storage/v1/object/<bucket>/<path>)
// by writing files under .localdb/storage, so photo uploads work offline.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UP = { host: "127.0.0.1", port: 54323 };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const STORE = path.join(ROOT, ".localdb", "storage");
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".pdf": "application/pdf" };

function storage(req, res) {
  const rel = decodeURIComponent(req.url.slice("/storage/v1/object/".length).split("?")[0]);
  const file = path.join(STORE, rel);
  if (!file.startsWith(STORE + path.sep)) return res.writeHead(400).end("bad path");
  if (req.method === "GET") {
    if (!fs.existsSync(file)) return res.writeHead(404).end(JSON.stringify({ error: "not_found" }));
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    return fs.createReadStream(file).pipe(res);
  }
  if (req.method === "DELETE") {
    fs.rmSync(file, { force: true });
    return res.writeHead(200, { "Content-Type": "application/json" }).end("{}");
  }
  if (req.method === "POST" || req.method === "PUT") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const out = fs.createWriteStream(file);
    req.pipe(out);
    out.on("finish", () => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ Key: rel })));
    return;
  }
  res.writeHead(405).end();
}

http
  .createServer((req, res) => {
    if (req.url.startsWith("/storage/v1/object/")) return storage(req, res);
    if (!req.url.startsWith("/rest/v1")) {
      res.writeHead(404).end("local proxy: only /rest/v1 and /storage/v1/object are served");
      return;
    }
    const path = req.url.slice("/rest/v1".length) || "/";
    const headers = { ...req.headers, host: `${UP.host}:${UP.port}` };
    delete headers.apikey;
    const up = http.request({ ...UP, path, method: req.method, headers }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    up.on("error", (e) => res.writeHead(502).end(String(e)));
    req.pipe(up);
  })
  .listen(54321, "127.0.0.1", () => console.log("local supabase proxy on http://localhost:54321"));
