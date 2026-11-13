-- Held inspections, tightly qualified (Parker 11/12: "home owner needs to be there").
-- The agreement pays a knocker $50 per held inspection: the homeowner was there,
-- the closer completed it with photos in the app, and it was the first
-- inspection PowerEdge ran at that address. The app recorded none of the
-- first two, so it could not tell a held inspection from any other.

-- The closer's answer when recording the verdict. Null = not answered.
alter table public.appointments add column if not exists homeowner_present boolean;

-- Inspection photos. Files live in the private storage bucket job-photos;
-- this row is the index the app reads.
create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  by text,
  path text not null,
  bytes integer
);
create index if not exists job_photos_job_idx on public.job_photos (job_id, created_at);
alter table public.job_photos enable row level security;
