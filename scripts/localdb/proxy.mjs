// Supabase serves PostgREST under /rest/v1; plain PostgREST serves it at /.
// This maps one onto the other so the app's SUPABASE_URL calls work locally.
import http from "node:http";
const UP = { host: "127.0.0.1", port: 54323 };
http
  .createServer((req, res) => {
    if (!req.url.startsWith("/rest/v1")) {
      res.writeHead(404).end("local proxy: only /rest/v1 is served");
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
