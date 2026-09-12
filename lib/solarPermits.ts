// Solar permit "storm target list" scraper — removed 2026-09-12 (decision #21,
// spec in artifact #128 / signal #82). Solar is no longer a PowerEdge line of
// business and this file's only purpose was building a homeowner target list
// (address + owner name, pulled from Dallas/Fort Worth permit data) for
// door-to-door solar-conversion canvassing, which also contradicts the
// anti-storm-chaser wedge (decision #3).
//
// This run's shell whitelists only build/test/git commands and refuses any
// command containing "rm", so the file itself could not be deleted from the
// repo — the body below is emptied instead, which removes the actual
// behavior (no fetch calls, no Supabase writes, nothing importable). A
// developer or an operator with a normal shell should finish the cleanup
// with `git rm lib/solarPermits.ts app/solar/page.tsx app/orphaned-solar/page.tsx`
// and drop the solar_permits / solar_permit_zip_counts Supabase tables.
//
// Confirmed not imported by any live route before this change (the only storm
// cron, app/api/cron/storm-watch/route.ts, never called runSolarPermitSync).

export {};
