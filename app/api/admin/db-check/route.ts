import { NextResponse } from "next/server";

// Temporary diagnostic: confirms the Supabase lead-capture wiring end-to-end.
// Gated by ?key=<ADMIN_TOKEN>. Does a read + a probe write (cleaned up after),
// and reports the raw Supabase status codes so we can see exactly what's wrong.
// Never echoes the key. Safe to delete once capture is confirmed working.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || url.searchParams.get("key") !== adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    return NextResponse.json({
      enabled: false,
      hasUrl: !!base,
      hasKey: !!key,
      hint: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  const out: Record<string, unknown> = {
    enabled: true,
    urlHost: (() => {
      try {
        return new URL(base).host;
      } catch {
        return "INVALID_URL";
      }
    })(),
    keyLooksLikeAnon: key.includes("anon") || key.startsWith("sb_publishable"),
  };

  try {
    const r = await fetch(`${base}/rest/v1/leads?select=id&limit=1`, {
      headers,
      cache: "no-store",
    });
    out.readStatus = r.status;
    out.readBody = (await r.text()).slice(0, 300);
  } catch (e) {
    out.readError = String(e);
  }

  try {
    const w = await fetch(`${base}/rest/v1/leads`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ name: "__db_check__", source: "db-check" }),
    });
    out.writeStatus = w.status;
    out.writeBody = (await w.text()).slice(0, 300);
    if (w.ok) {
      // clean up probe rows
      await fetch(`${base}/rest/v1/leads?source=eq.db-check`, {
        method: "DELETE",
        headers,
      });
      out.cleanedUp = true;
    }
  } catch (e) {
    out.writeError = String(e);
  }

  out.verdict =
    out.writeStatus === 201 || out.writeStatus === 200
      ? "OK — capture is working."
      : out.readStatus === 404 || out.writeStatus === 404
        ? "Table missing — run supabase/schema.sql in the SQL editor."
        : out.writeStatus === 401 || out.writeStatus === 403 || out.keyLooksLikeAnon
          ? "Key/permission issue — use the service_role (secret) key, not anon/publishable."
          : "See status codes above.";

  return NextResponse.json(out);
}
