// Solar is no longer offered (Parker, decision #14, 2026-09-04) — this page
// is retired. Route kept only so /orphaned-solar 404s cleanly instead of
// orphaning; delete this directory entirely (and app/solar/,
// lib/solarPermits.ts) the next time someone has shell access — this run's
// tools couldn't rm.
import { notFound } from "next/navigation";

export default function OrphanedSolarPage(): never {
  notFound();
}
