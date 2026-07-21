// BatchData skip trace — turns storm targets (owner + address) into DIALABLE
// rows: phones + DNC flags stored on storm_targets. Runs from the hourly cron,
// highest-score untraced targets first, capped per run for cost control.
// Env: BATCHDATA_API_KEY (skip-trace no-ops until set)
//      SKIPTRACE_MAX_PER_RUN (default 100 — ~$10-20/run at list prices)

const BATCH_URL = "https://api.batchdata.com/api/v1/property/skip-trace";

function dbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

type TraceTarget = {
  id: string;
  owner_name: string;
  address: string;
  city: string;
  zip: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractPhones(person: any): Array<{ number: string; dnc: boolean }> {
  const phones = (person?.phoneNumbers ?? person?.phones ?? []) as any[];
  return phones
    .map((p) => ({
      number: String(p?.number ?? p?.phoneNumber ?? "").replace(/[^0-9]/g, ""),
      dnc: !!(p?.dnc ?? p?.isDnc ?? p?.dncStatus),
    }))
    .filter((p) => p.number.length >= 10)
    .slice(0, 2);
}

export async function runSkipTrace(): Promise<{ traced: number; hits: number; ok: boolean }> {
  const apiKey = process.env.BATCHDATA_API_KEY;
  const url = process.env.SUPABASE_URL;
  if (!apiKey || !url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { traced: 0, hits: 0, ok: !apiKey }; // no key = intentional no-op
  }
  const cap = Math.min(500, parseInt(process.env.SKIPTRACE_MAX_PER_RUN || "100", 10) || 100);
  try {
    // Highest-score untraced targets with a real city (BatchData needs city+zip).
    const res = await fetch(
      `${url}/rest/v1/storm_targets?select=id,owner_name,address,city,zip&skip_traced_at=is.null&phone=is.null&city=neq.&zip=neq.&order=score.desc.nullslast&limit=${cap}`,
      { headers: dbHeaders(), cache: "no-store" },
    );
    if (!res.ok) return { traced: 0, hits: 0, ok: false };
    const targets = (await res.json()) as TraceTarget[];
    if (targets.length === 0) return { traced: 0, hits: 0, ok: true };

    let hits = 0;
    // BatchData accepts batched requests; keep batches modest.
    for (let i = 0; i < targets.length; i += 50) {
      const chunk = targets.slice(i, i + 50);
      const body = {
        requests: chunk.map((t) => ({
          propertyAddress: {
            street: t.address,
            city: t.city.replace(/ (TIF|SUBDIST|REINVESTMENT).*$/i, "").trim() || t.city,
            state: "TX",
            zip: t.zip,
          },
        })),
      };
      const bres = await fetch(BATCH_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90000),
      });
      if (!bres.ok) {
        console.error("[skiptrace] batchdata non-2xx", bres.status, (await bres.text()).slice(0, 300));
        // mark chunk as attempted so we don't re-bill failures forever? No —
        // leave untraced so a config fix retries them.
        break;
      }
      const data = await bres.json();
      const persons = (data?.results?.persons ?? data?.persons ?? []) as any[];

      // Match responses back to requests by index when possible, else by address.
      for (let j = 0; j < chunk.length; j++) {
        const t = chunk[j];
        const person =
          persons[j] ??
          persons.find((p: any) =>
            String(p?.propertyAddress?.street ?? "")
              .toUpperCase()
              .startsWith(t.address.slice(0, 12)),
          );
        const phones = person ? extractPhones(person) : [];
        if (phones.length > 0) hits++;
        await fetch(`${url}/rest/v1/storm_targets?id=eq.${t.id}`, {
          method: "PATCH",
          headers: { ...dbHeaders(), Prefer: "return=minimal" },
          body: JSON.stringify({
            phone: phones[0]?.number ?? null,
            phone_dnc: phones[0] ? phones[0].dnc : null,
            phone2: phones[1]?.number ?? null,
            phone2_dnc: phones[1] ? phones[1].dnc : null,
            skip_traced_at: new Date().toISOString(),
          }),
        });
      }
    }
    return { traced: targets.length, hits, ok: true };
  } catch (err) {
    console.error("[skiptrace] failed", err);
    return { traced: 0, hits: 0, ok: false };
  }
}
