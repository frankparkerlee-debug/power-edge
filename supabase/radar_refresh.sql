-- Daily refresh of the storm data behind Best doors and the Knock map
-- (Parker, 2026-11-11: "Daily data refresh"). Before this, radar hail, wind
-- and Priority were a one-time load from 2026-11-10.
--
-- How it runs (all times UTC):
--   13:20 and 17:20  POST /api/cron/radar-refresh  (app/api/cron/radar-refresh)
--                    Loads each new radar day into hail_days (NOAA MRMS MESH
--                    24h max, the 12Z file of day D+1 covers local day D) and
--                    the last 3 days of NWS wind/tornado reports into
--                    wind_reports. The second run catches a late file.
--   13:50 and 17:50  select public.refresh_cell_signals()
--                    Rebuilds cell_signals from hail_days and wind_reports,
--                    the same rules as scripts/house-scoring/cell_signals.py,
--                    then re-dates hail12_date to the nearest NWS hail report.
--   Mon 15:30        POST /api/cron/permits-refresh   (new Dallas re-roof permits)
-- doors_near and field_doors read cell_signals, hail_days and reroof_permits
-- directly, so the Map picks the new data up on its next load.

-- NWS Local Storm Reports that can damage a roof: wind damage, tornadoes,
-- and gusts of 58 mph+, over North Texas, from the Fort Worth office (FWD).
create table if not exists public.wind_reports (
  id text primary key,                 -- valid|type|lat|lon, as IEM reports it
  valid_at timestamptz not null,
  local_date date not null,            -- Central time
  type text not null,                  -- NWS typetext, e.g. TSTM WND DMG, TORNADO
  mph real,
  lat double precision not null,
  lon double precision not null,
  city text,
  remark text,
  fetched_at timestamptz not null default now()
);
create index if not exists wind_reports_local_date_idx on public.wind_reports (local_date);
alter table public.wind_reports enable row level security;

-- One row per radar day processed, so a missed or late file is retried and a
-- quiet day is not fetched again. cells = -1: NOAA never published the file.
create table if not exists public.radar_days (
  local_date date primary key,
  file_key text,
  cells int not null,                  -- DFW cells at 0.75 in+
  max_in real,
  fetched_at timestamptz not null default now()
);
alter table public.radar_days enable row level security;

create or replace function public.refresh_cell_signals(
  p_today date default (now() at time zone 'America/Chicago')::date,
  p_write boolean default true
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  d12 date := p_today - 365;
  d24 date := p_today - 730;
  out jsonb;
begin
  create temp table _new (like public.cell_signals) on commit drop;

  insert into _new (r, c, hail12_in, hail12_date, hail24_in, hail24_date, big_hail_old_date,
                    big_hail_days, wind_date, wind_kind, wind_mph, wind_roof, wind_dist_mi,
                    wind_place, computed_on)
  with g3 as (
    -- Each cell takes the biggest hail in it and its 8 neighbors, per day, to
    -- allow for radar position error (np.max over a 3x3 window in the script).
    select h.r + dr as r, h.c + dc as c, h.local_date, max(h.mesh_in) as v
    from public.hail_days h
    cross join generate_series(-1, 1) as dr
    cross join generate_series(-1, 1) as dc
    where h.local_date >= d24
      and h.r + dr between 0 and 164 and h.c + dc between 0 and 239
    group by 1, 2, 3
  ),
  h12 as (  -- biggest in the last 12 months; on a tie the latest day, which
            -- starts the later claim window
    select distinct on (r, c) r, c, v, local_date from g3
    where local_date >= d12 order by r, c, v desc, local_date desc
  ),
  h24 as (  -- biggest in the 12 months before that
    select distinct on (r, c) r, c, v, local_date from g3
    where local_date < d12 order by r, c, v desc, local_date desc
  ),
  big as (  -- golf-ball hail in the cell itself: the roof was likely replaced
    select r, c, max(local_date) filter (where local_date < d12) as old_date, count(*) as n
    from public.hail_days where mesh_in >= 2.0 group by r, c
  ),
  wr as (
    select w.*,
      coalesce(w.remark, '') ~* '(roof|shingle|home|house|residence|structur)' as roof,
      (case when w.type = 'TORNADO' then 4 else 0 end)
      + (case when coalesce(w.remark, '') ~* '(roof|shingle|home|house|residence|structur)' then 2 else 0 end)
      + (case when coalesce(w.mph, 0) >= 70 then 1 else 0 end)
      + (case when w.type like '%DMG%' then 1 else 0 end) as strength
    from public.wind_reports w where w.local_date >= d24
  ),
  wc as (  -- the strongest report within 1 mi of each cell, this year first
    select distinct on (cell.r, cell.c) cell.r, cell.c, wr.local_date, wr.type, wr.mph,
      wr.roof, cell.dist, wr.city
    from wr
    cross join lateral (
      select rr as r, cc as c,
        sqrt(power((wr.lat - (33.545 - 0.01 * rr)) * 69.0, 2)
           + power((wr.lon - (-98.145 + 0.01 * cc)) * 69.0 * cos(radians(33.545 - 0.01 * rr)), 2)) as dist
      from generate_series(greatest(0, floor((33.545 - wr.lat - 0.0146) / 0.01)::int),
                           least(164, ceil((33.545 - wr.lat + 0.0146) / 0.01)::int)) as rr,
           generate_series(greatest(0, floor((wr.lon + 98.145 - 0.0175) / 0.01)::int),
                           least(239, ceil((wr.lon + 98.145 + 0.0175) / 0.01)::int)) as cc
    ) cell
    where cell.dist <= 1.0
    order by cell.r, cell.c, (wr.local_date >= d12) desc, wr.strength desc, cell.dist
  ),
  keys as (
    select r, c from h12 where v >= 0.75
    union select r, c from h24 where v >= 0.75
    union select r, c from big
    union select r, c from wc
  )
  select k.r, k.c,
    case when h12.v >= 0.75 then round(h12.v::numeric, 2) end,
    case when h12.v >= 0.75 then h12.local_date end,
    case when h24.v >= 0.75 then round(h24.v::numeric, 2) end,
    case when h24.v >= 0.75 then h24.local_date end,
    big.old_date, coalesce(big.n, 0),
    wc.local_date,
    case when wc.type = 'TORNADO' then 'tornado'
         when wc.type in ('TSTM WND DMG', 'NON-TSTM WND DMG') then 'wind_damage'
         when wc.type is not null then 'wind_gust' end,
    nullif(wc.mph, 0), wc.roof, round(wc.dist::numeric, 2), nullif(left(coalesce(wc.city, ''), 60), ''),
    p_today
  from keys k
  left join h12 on h12.r = k.r and h12.c = k.c
  left join h24 on h24.r = k.r and h24.c = k.c
  left join big on big.r = k.r and big.c = k.c
  left join wc on wc.r = k.r and wc.c = k.c;

  -- Radar days run 7am to 7am, so hail after midnight carries the previous
  -- day. Re-date to the LOCAL date of the nearest NWS hail report within 15 mi
  -- on the same radar day, which is how storm_targets.storm_date is dated.
  with rep as (
    select lat, lon, (valid_at at time zone 'America/Chicago')::date as local_date,
           ((valid_at at time zone 'America/Chicago') - interval '7 hours')::date as radar_day
    from public.storm_events where type = 'hail'
  ),
  cells as (
    select r, c, hail12_date, 33.545 - 0.01 * r as clat, -98.145 + 0.01 * c as clon
    from _new where hail12_date is not null
  ),
  nearest as (
    select distinct on (cl.r, cl.c) cl.r, cl.c, rp.local_date,
      3958.8 * 2 * asin(sqrt(power(sin(radians(rp.lat - cl.clat) / 2), 2)
        + cos(radians(cl.clat)) * cos(radians(rp.lat)) * power(sin(radians(rp.lon - cl.clon) / 2), 2))) as mi
    from cells cl join rep rp on rp.radar_day = cl.hail12_date
      and rp.lat between cl.clat - 0.25 and cl.clat + 0.25
      and rp.lon between cl.clon - 0.3 and cl.clon + 0.3
    order by cl.r, cl.c, mi
  )
  update _new n set hail12_date = x.local_date
  from nearest x
  where x.r = n.r and x.c = n.c and x.mi <= 15 and x.local_date <> n.hail12_date;

  select jsonb_build_object(
    'today', p_today,
    'written', p_write,
    'cells_new', (select count(*) from _new),
    'cells_before', (select count(*) from public.cell_signals),
    'hail12_same', (select count(*) from _new n join public.cell_signals o using (r, c)
                    where n.hail12_in is not distinct from o.hail12_in and n.hail12_date is not distinct from o.hail12_date),
    'hail24_same', (select count(*) from _new n join public.cell_signals o using (r, c)
                    where n.hail24_in is not distinct from o.hail24_in),
    'big_same', (select count(*) from _new n join public.cell_signals o using (r, c)
                 where n.big_hail_old_date is not distinct from o.big_hail_old_date and n.big_hail_days = o.big_hail_days),
    'wind_same', (select count(*) from _new n join public.cell_signals o using (r, c)
                  where n.wind_date is not distinct from o.wind_date and n.wind_kind is not distinct from o.wind_kind),
    'only_new', (select count(*) from _new n where not exists (select 1 from public.cell_signals o where o.r = n.r and o.c = n.c)),
    'only_old', (select count(*) from public.cell_signals o where not exists (select 1 from _new n where n.r = o.r and n.c = o.c))
  ) into out;

  if p_write then
    delete from public.cell_signals;
    insert into public.cell_signals select * from _new;
  end if;
  return out;
end;
$$;

revoke all on function public.refresh_cell_signals(date, boolean) from public, anon, authenticated;
grant execute on function public.refresh_cell_signals(date, boolean) to service_role;

-- Schedules (applied separately, once the routes are deployed). The two HTTP
-- jobs reuse the x-admin-token header of the existing 'poweredge-hourly' job.
--   cron.schedule('poweredge-radar-refresh', '20 13,17 * * *', <http_post to /api/cron/radar-refresh>)
--   cron.schedule('poweredge-cell-signals',  '50 13,17 * * *', 'select public.refresh_cell_signals()')
--   cron.schedule('poweredge-permits-refresh', '30 15 * * 1', <http_post to /api/cron/permits-refresh>)
