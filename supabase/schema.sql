-- PowerEdge lead capture schema.
-- Run this in the Supabase SQL editor (Database → SQL editor → New query → Run).
-- The app connects with the SERVICE ROLE key, which bypasses RLS; RLS is enabled
-- with no policies so nothing else (anon/public) can read the table.

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text,
  phone         text,
  email         text,
  address       text,
  zip           text,
  service       text,
  message       text,
  solar         boolean default false,
  source        text,
  page_path     text,
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  gclid         text
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

alter table public.leads enable row level security;
-- No policies = only the service-role key (used server-side) can read/write.

-- If the table already exists from an earlier run, add the address column:
alter table public.leads add column if not exists address text;

-- Every address run through the claim check / storm check — including visitors
-- who never submit the form. Self-identified storm-hit addresses: retargeting +
-- door-knock gold, and the seed data for the rep "knock map."
create table if not exists public.roof_checks (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  address     text,
  matched     text,
  lat         double precision,
  lon         double precision,
  hail_count  int,
  largest_in  double precision,
  qualifies   boolean,
  tool        text
);

create index if not exists roof_checks_created_at_idx on public.roof_checks (created_at desc);

alter table public.roof_checks enable row level security;
-- No policies = service-role only, same as leads.
