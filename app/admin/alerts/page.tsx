import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";

// Storm alerts: who signed up, and which warnings covered them. Team only.
export const metadata: Metadata = {
  title: "Storm alerts",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Signup = {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  rep: string | null;
  source: string;
  opted_out_at: string | null;
  lat: number | null;
};
type Warning = {
  id: string;
  phenomena: string;
  issued_at: string;
  expires_at: string;
  hail_in: number | null;
  wind_mph: number | null;
};
type Hit = {
  warning_id: string;
  kind: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  email_status: string | null;
  text_status: string | null;
};

function db() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return { apikey: key, Authorization: `Bearer ${key}` };
}
async function get<T>(path: string): Promise<T[]> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { headers: db(), cache: "no-store" });
  return r.ok ? ((await r.json()) as T[]) : [];
}

const phoneFmt = (p: string) => p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
  });
const STATUS: Record<string, string> = {
  sent: "Sent",
  failed: "Failed",
  none: "No email",
  skipped: "Already alerted today",
  no_provider: "Not sent: no text tool yet",
};

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  const user = await currentUser(key);
  if (!user) {
    return (
      <div className="min-h-screen bg-white px-6 py-10 text-[#0b0e13]">
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-2xl font-extrabold">Storm alerts</h1>
          <p className="mt-2 text-sm text-gray-600">
            <Link href="/login" className="font-medium text-[#0c7a40] underline">Sign in</Link> to open this.
          </p>
        </div>
      </div>
    );
  }

  const [signups, warnings, hits] = await Promise.all([
    get<Signup>("alert_signups?select=id,created_at,name,phone,email,address,rep,source,opted_out_at,lat&order=created_at.desc&limit=300"),
    get<Warning>("storm_warnings?select=id,phenomena,issued_at,expires_at,hail_in,wind_mph&order=issued_at.desc&limit=15"),
    get<Hit>("storm_warning_hits?select=warning_id,kind,name,address,phone,email_status,text_status&order=created_at.desc&limit=500"),
  ]);
  const active = signups.filter((s) => !s.opted_out_at);
  const byWarning = new Map<string, Hit[]>();
  for (const h of hits) byWarning.set(h.warning_id, [...(byWarning.get(h.warning_id) ?? []), h]);

  async function stop(formData: FormData) {
    "use server";
    const me = await currentUser();
    const id = String(formData.get("id") || "");
    if (!me || !/^[0-9a-f-]{36}$/i.test(id)) return;
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/alert_signups?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ opted_out_at: new Date().toISOString() }),
    });
    revalidatePath("/admin/alerts");
  }

  return (
    <div className="min-h-screen bg-white px-4 pb-16 pt-5 text-[#0b0e13] md:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold">Storm alerts</h1>
            <p className="mt-1 text-sm text-gray-500">
              {active.length} signed up · {signups.length - active.length} stopped · {warnings.length} warnings
            </p>
          </div>
          <Link href="/storm-alerts" className="rounded-lg bg-[#0b0e13] px-4 py-2.5 text-sm font-bold text-white">
            Sign up a homeowner
          </Link>
        </div>

        <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-gray-500">Warnings</h2>
        {warnings.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No hail or tornado warnings over the 11 counties since this started. The check runs every few minutes.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {warnings.map((w) => {
              const list = byWarning.get(w.id) ?? [];
              return (
                <li key={w.id} className="rounded-lg border border-gray-200 p-3">
                  <p className="font-semibold">
                    {w.phenomena === "TO" ? "Tornado warning" : "Severe thunderstorm warning"}
                    {w.hail_in ? `, hail to ${w.hail_in.toFixed(2)} in` : ""}
                    {w.wind_mph ? `, wind to ${w.wind_mph} mph` : ""}
                  </p>
                  <p className="text-[13px] text-gray-500">
                    {when(w.issued_at)} to {when(w.expires_at)} · {list.length} of ours inside
                  </p>
                  {list.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {list.map((h, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium">{h.name || "Owner unknown"}</span>
                          <span className="text-gray-500"> · {h.address}</span>
                          {h.phone && (
                            <a href={`tel:${h.phone}`} className="ml-2 text-[#0c7a40] underline">{phoneFmt(h.phone)}</a>
                          )}
                          <span className="block text-[13px] text-gray-500">
                            {h.kind === "job"
                              ? "Open job"
                              : `Email: ${STATUS[h.email_status ?? "none"] ?? h.email_status} · Text: ${STATUS[h.text_status ?? "none"] ?? h.text_status}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-gray-500">Signed up</h2>
        {signups.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No one yet. Offer it at every door, including the no-damage ones.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {signups.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="truncate text-sm text-gray-600">{s.address}</p>
                  <p className="text-[13px] text-gray-500">
                    <a href={`tel:${s.phone}`} className="underline">{phoneFmt(s.phone)}</a>
                    {" · "}
                    {s.source === "door" ? `At the door${s.rep ? ` by ${s.rep}` : ""}` : "Online"}, {when(s.created_at)}
                    {s.lat == null && " · Address not found on the map"}
                  </p>
                </div>
                {s.opted_out_at ? (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[13px] text-gray-500">Stopped</span>
                ) : (
                  <form action={stop}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="shrink-0 text-[13px] text-gray-500 underline">Stop alerts</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
