-- Storm alerts: homeowners who asked to hear from us when a hail or tornado
-- warning covers their address, and the warnings that did.
--
-- Additive only. Service role access only (RLS on, no policies).

-- Who signed up, with the exact consent they agreed to. Texts need prior
-- express written consent (47 CFR 64.1200(f)(9)), so the wording, version,
-- typed signature, time, IP and device are stored with every row.
create table if not exists public.alert_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,                 -- E.164, +1XXXXXXXXXX
  email text,
  address text not null,
  zip text,
  lat double precision,
  lon double precision,
  target_id uuid,                      -- storm_targets row when signed up at a known door
  rep text,                            -- team member signed in on the device, if any
  source text not null default 'web',  -- door | web
  consent_text text not null,
  consent_version text not null,
  signature text not null,             -- typed full name
  consent_at timestamptz not null default now(),
  consent_ip text,
  consent_ua text,
  opted_out_at timestamptz
);
create unique index if not exists alert_signups_phone_address_idx
  on public.alert_signups (phone, upper(address));
create index if not exists alert_signups_latlon_idx on public.alert_signups (lat, lon);
comment on table public.alert_signups is
  'Homeowners who opted in to storm alerts, with verbatim consent. Never text anyone not in this table with opted_out_at null.';
alter table public.alert_signups enable row level security;

-- Each qualifying NWS warning (severe thunderstorm with 1 in+ hail or 70 mph+
-- wind, or any tornado warning) that touched the 11-county area. id is the
-- VTEC event key, e.g. 2026-FWD-SV-0070, so polygon updates fold into one row.
create table if not exists public.storm_warnings (
  id text primary key,
  phenomena text not null,             -- SV | TO
  eventid int not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  hail_in real,
  wind_mph real,
  tornado text,
  polygon jsonb,                       -- latest polygon seen
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  team_alerted_at timestamptz
);
comment on table public.storm_warnings is
  'NWS warnings (IEM storm-based warning feed) that qualified for storm alerts. Polled every few minutes.';
alter table public.storm_warnings enable row level security;

-- Who was inside a warning. One row per warning per home, so a warning that
-- is updated five times still reaches a home once.
create table if not exists public.storm_warning_hits (
  warning_id text not null references public.storm_warnings(id) on delete cascade,
  kind text not null,                  -- signup | job
  ref_id text not null,                -- alert_signups.id or jobs.id
  name text,
  phone text,
  email text,
  address text,
  lat double precision,
  lon double precision,
  created_at timestamptz not null default now(),
  email_status text,                   -- sent | failed | none
  text_status text,                    -- sent | failed | no_provider | skipped
  primary key (warning_id, kind, ref_id)
);
create index if not exists storm_warning_hits_created_idx on public.storm_warning_hits (created_at desc);
alter table public.storm_warning_hits enable row level security;

-- Scheduled 2026-11-10 as pg_cron job 'poweredge-storm-warnings', every 5
-- minutes (warnings last 30 to 60 minutes; 5 still catches one cancelled
-- early). It was created by copying the 'poweredge-hourly' job's call and
-- swapping the URL, so the admin token is never written in a file:
--
--   select cron.schedule('poweredge-storm-warnings', '*/5 * * * *',
--     replace(replace(command, '/api/cron/claim-nurture', '/api/cron/storm-warnings'),
--             'timeout_milliseconds := 300000', 'timeout_milliseconds := 60000'))
--   from cron.job where jobname = 'poweredge-hourly';
