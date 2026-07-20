import { NextResponse } from "next/server";
import { listStormTargets } from "@/lib/parcels";

/**
 * Storm-target export for dialing / skip trace / direct mail.
 *   GET /api/admin/storm-targets?key=<ADMIN_TOKEN>&date=2026-04-28&format=csv
 * Omit `date` for the latest 1000 across all storm days. CSV columns match
 * what batch skip-trace vendors (BatchData etc.) expect: owner + address.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!process.env.ADMIN_TOKEN || key !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const date = url.searchParams.get("date") || undefined;
  const county = url.searchParams.get("county") || undefined;
  const city = url.searchParams.get("city") || undefined;
  const daysRaw = url.searchParams.get("days") || "";
  const targets = await listStormTargets(
    {
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
      county,
      city,
      days: ["10", "30", "90"].includes(daysRaw) ? Number(daysRaw) : undefined,
    },
    1000,
  );

  if (url.searchParams.get("format") === "csv") {
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header =
      "storm_date,score,owner_name,address,city,county,zip,owner_mailing,property_type,year_built,value,hail_size_in,solar,absentee,status";
    const lines = targets.map((t) =>
      [
        t.storm_date,
        t.score,
        t.owner_name,
        t.address,
        t.city,
        t.county,
        t.zip,
        t.owner_mailing,
        t.property_type,
        t.year_built ?? "",
        t.value ?? "",
        t.hail_size_in ?? "",
        t.solar ? "yes" : "",
        t.absentee ? "yes" : "",
        t.status,
      ]
        .map(esc)
        .join(","),
    );
    return new NextResponse([header, ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="storm-targets${date ? `-${date}` : ""}.csv"`,
      },
    });
  }
  return NextResponse.json({ ok: true, count: targets.length, targets });
}
