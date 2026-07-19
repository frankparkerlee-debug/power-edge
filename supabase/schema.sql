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

-- ============================ STORM ENGINE (2026-07-18) ============================
-- Applied to the live project via the Supabase MCP migration "storm_engine_phase1".
-- Kept here for repo parity.

create table if not exists public.storm_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  valid_at    timestamptz not null,
  type        text not null,             -- hail | wind_gust | wind_dmg
  magnitude   double precision,          -- inches (hail) or mph (wind_gust)
  city        text,
  county      text,
  lat         double precision not null,
  lon         double precision not null,
  wfo         text,
  remark      text
);
create unique index if not exists storm_events_dedupe_idx
  on public.storm_events (valid_at, type, lat, lon);
create index if not exists storm_events_valid_at_idx on public.storm_events (valid_at desc);
alter table public.storm_events enable row level security;

create table if not exists public.solar_permits (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  permit_number text not null unique,
  source        text,
  address       text,
  zip           text,
  city          text,
  issued_date   text,
  contractor    text,
  land_use      text,
  description   text,
  lat           double precision,
  lon           double precision
);
create index if not exists solar_permits_zip_idx on public.solar_permits (zip);
alter table public.solar_permits enable row level security;

create or replace view public.solar_permit_zip_counts as
  select zip, count(*)::int as permits
  from public.solar_permits
  where zip is not null and zip <> ''
  group by zip
  order by permits desc;

create table if not exists public.storm_targets (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  storm_date    date,
  address       text,
  city          text,
  zip           text,
  lat           double precision,
  lon           double precision,
  owner_name    text,
  owner_mailing text,
  phone         text,
  phone2        text,
  property_type text,
  year_built    int,
  value         numeric,
  hail_size_in  double precision,
  wind_mph      double precision,
  solar         boolean default false,
  solar_source  text,
  score         double precision,
  status        text default 'new',
  hubspot_id    text,
  notes         text
);
create index if not exists storm_targets_storm_date_idx on public.storm_targets (storm_date desc, score desc);
alter table public.storm_targets enable row level security;

alter table public.solar_permits add column if not exists owner text;

-- Phase 1b additions (applied via MCP migration storm_targets_phase1b):
alter table public.storm_targets add column if not exists absentee boolean default false;
create unique index if not exists storm_targets_dedupe_idx on public.storm_targets (storm_date, address);
create or replace view public.storm_target_days as
  select storm_date, count(*)::int as targets,
         count(*) filter (where solar)::int as solar_targets
  from public.storm_targets group by storm_date order by storm_date desc;

-- Tarrant roll (TAD PropertyData one-time load, 2026-07-19; applied via MCP):
create table if not exists public.tarrant_roll (
  account text primary key, pidn text, owner text, mail_addr text,
  mail_citystate text, mail_zip text, situs text, situs_norm text,
  class text, city text, land_value bigint, imp_value bigint,
  total_value bigint, bedrooms int, year_built int, living_area numeric,
  pool boolean default false
);
create index if not exists tarrant_roll_situs_norm_idx on public.tarrant_roll (situs_norm);
alter table public.tarrant_roll enable row level security;

-- County/city filters (applied via MCP migration storm_targets_county):
alter table public.storm_targets add column if not exists county text;
create index if not exists storm_targets_county_city_idx on public.storm_targets (county, city);
create or replace view public.storm_target_cities as
  select county, city, count(*)::int as targets from public.storm_targets
  where city is not null and city <> '' group by county, city order by targets desc;

-- TxGIO StratMap county parcels w/ centroids (collin/denton/kaufman; MCP migration parcels_table):
create table if not exists public.parcels (
  id bigint generated always as identity primary key,
  county text not null, prop_id text, owner text, situs text, situs_norm text,
  city text, zip text, mail text, land_use text, year_built int,
  imp_value bigint, mkt_value bigint, lat double precision, lon double precision,
  unique (county, prop_id)
);
create index if not exists parcels_lat_lon_idx on public.parcels (lat, lon);
create index if not exists parcels_county_idx on public.parcels (county);
alter table public.parcels enable row level security;
