-- House scoring: which doors are worth knocking, and why.
--
-- Additive only. Creates two tables and three functions; changes nothing that
-- exists. Signals live on a ~1 km grid (0.01 degree cells) over North Texas so
-- that any house, targeted or not, can be scored with one lookup.
--
--   cell (r, c): center lat = 33.545 - 0.01 * r, center lon = -98.145 + 0.01 * c
--
-- Sources (all free, public):
--   Hail: NOAA MRMS MESH, 24-hour max ending 12:00Z, labeled with the LOCAL
--         date it covers (7am to 7am Central). Radar estimate, not a measurement.
--   Wind: NWS Local Storm Reports (wind damage, tornado, gusts 58 mph+).
--         Gridded gust analyses were tested and missed every measured damaging
--         gust on 2026-04-25, so wind is "reported nearby", never "at the house".

create table if not exists public.hail_days (
  r smallint not null,
  c smallint not null,
  local_date date not null,
  mesh_in real not null,
  primary key (r, c, local_date)
);
comment on table public.hail_days is
  'Radar hail (NOAA MRMS MESH) per ~1 km cell per local storm day, cells with 0.75 in or more. History since 2020-10-14. Radar estimate, not a measurement.';
alter table public.hail_days enable row level security;

create table if not exists public.cell_signals (
  r smallint not null,
  c smallint not null,
  hail12_in real,             -- biggest radar hail in the last 12 months (3x3 cell max)
  hail12_date date,
  hail24_in real,             -- biggest radar hail 12 to 24 months ago
  hail24_date date,
  big_hail_old_date date,     -- last 1.75 in+ hail older than 12 months: roof likely replaced after it
  big_hail_days smallint not null default 0,
  wind_date date,             -- strongest wind or tornado report within 1 mile, last 24 months
  wind_kind text,             -- tornado | wind_damage | wind_gust
  wind_mph real,
  wind_roof boolean,          -- the report mentions roofs or homes
  wind_dist_mi real,
  wind_place text,
  computed_on date not null,
  primary key (r, c)
);
comment on table public.cell_signals is
  'Per ~1 km cell: recent radar hail, last big hail (roof-age inference) and nearby NWS wind or tornado reports. Recomputed by scripts/house-scoring; computed_on says when.';
alter table public.cell_signals enable row level security;

create or replace function public.cell_r(lat double precision) returns int
  language sql immutable as $$ select (3354 - floor(lat * 100))::int $$;
create or replace function public.cell_c(lon double precision) returns int
  language sql immutable as $$ select (floor(lon * 100) + 9815)::int $$;

-- Best doors around a point. Scores every house we can place on the map:
-- storm targets (all 11 counties) plus residential parcels (the 9 counties in
-- the parcels table). A parcel already on the target list appears once, as the
-- target, so knocks and come-backs stay attached to it.
--
-- Roof age is an estimate. Radar history starts in 2020, so:
--   built 1996 to 2011 with no golf-ball hail since 2020 -> roof may be original
--   built before 1996 -> replaced at least once, date unknown (small weight)
--   golf-ball hail older than a year -> roof likely replaced on that claim
drop function if exists public.doors_near(double precision, double precision, double precision, int);
create function public.doors_near(
  p_lat double precision,
  p_lon double precision,
  p_miles double precision default 1.0,
  p_limit int default 200
)
returns table (
  src text, target_id uuid, county text, address text, street text, city text, zip text,
  owner_name text, mailing text, absentee boolean, lat double precision, lon double precision,
  dist_mi double precision, year_built int, value bigint,
  hail_in real, hail_date date, wind_kind text, wind_date date, wind_mph real,
  wind_roof boolean, wind_dist_mi real, roof_year int, roof_basis text,
  last_outcome text, last_knock_at timestamptz, score int, reasons text[]
)
language sql stable
as $$
with box as (
  select p_miles / 69.0 as dlat, p_miles / (69.0 * cos(radians(p_lat))) as dlon
),
tgt as (
  select distinct on (upper(trim(t.address)))
    'target'::text as src, t.id as target_id, t.county, upper(trim(t.address)) as address,
    t.city, t.zip, t.owner_name, t.owner_mailing as mailing, coalesce(t.absentee, false) as absentee, t.lat, t.lon,
    nullif(t.year_built, 0)::int as year_built, t.value::bigint as value, t.status
  from public.storm_targets t, box
  where t.lat between p_lat - box.dlat and p_lat + box.dlat
    and t.lon between p_lon - box.dlon and p_lon + box.dlon
  order by upper(trim(t.address)), t.storm_date desc
),
par as (
  select
    'parcel'::text as src, null::uuid as target_id, p.county, upper(trim(p.situs)) as address,
    p.city, left(p.zip, 5) as zip, p.owner as owner_name, upper(trim(p.mail)) as mailing,
    -- Same rule as lib/parcels.ts isAbsentee: mailing must start with the
    -- house number and first street word.
    case
      when coalesce(trim(p.mail), '') = '' then false
      else position(
        (split_part(regexp_replace(upper(p.situs), '[^A-Z0-9 ]', '', 'g'), ' ', 1) || ' ' ||
         split_part(regexp_replace(upper(p.situs), '[^A-Z0-9 ]', '', 'g'), ' ', 2))
        in regexp_replace(upper(p.mail), '[^A-Z0-9 ]', '', 'g')) <> 1
    end as absentee,
    p.lat, p.lon, nullif(p.year_built, 0)::int as year_built, p.mkt_value::bigint as value, null::text as status
  from public.parcels p, box
  where p.lat between p_lat - box.dlat and p_lat + box.dlat
    and p.lon between p_lon - box.dlon and p_lon + box.dlon
    and (p.land_use like 'A%' or coalesce(p.land_use, '') = '')
    and coalesce(p.imp_value, 0) > 25000
    and coalesce(trim(p.situs), '') <> ''
    and coalesce(trim(p.owner), '') <> ''
),
houses as (
  select * from tgt
  union all
  select * from par where not exists (select 1 from tgt where tgt.address = par.address)
),
scored as (
  select
    h.*,
    3958.8 * 2 * asin(sqrt(
      power(sin(radians(h.lat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(h.lat)) * power(sin(radians(h.lon - p_lon) / 2), 2)
    )) as dist_mi,
    s.hail12_in, s.hail12_date, s.hail24_in, s.hail24_date, s.big_hail_old_date,
    s.wind_kind, s.wind_date, s.wind_mph, s.wind_roof, s.wind_dist_mi,
    k.outcome as last_outcome, k.created_at as last_knock_at,
    case
      when s.big_hail_old_date is not null
        and extract(year from s.big_hail_old_date)::int + 1 >= coalesce(h.year_built, 0)
        then extract(year from s.big_hail_old_date)::int + 1
      else h.year_built
    end as roof_year,
    case
      when s.big_hail_old_date is not null
        and extract(year from s.big_hail_old_date)::int + 1 >= coalesce(h.year_built, 0) then 'hail'
      when h.year_built is not null then 'built'
    end as roof_basis
  from houses h
  left join public.cell_signals s on s.r = public.cell_r(h.lat) and s.c = public.cell_c(h.lon)
  left join public.target_last_knock k on k.target_id = h.target_id
),
pts as (
  select sc.*,
    extract(year from current_date)::int - sc.year_built as home_age,
    (case
       when sc.hail12_in >= 2.5 then 40 when sc.hail12_in >= 1.75 then 32
       when sc.hail12_in >= 1.25 then 22 when sc.hail12_in >= 1 then 15
       when sc.hail12_in >= 0.75 then 6 else 0 end)
    + (case when sc.hail24_in >= 1.75 then 6 when sc.hail24_in >= 1 then 3 else 0 end)
    + (case
         when sc.wind_date >= current_date - 365 then
           (case when sc.wind_kind = 'tornado' then 25 else 12 end)
           + (case when sc.wind_roof then 8 else 0 end)
           + (case when sc.wind_mph >= 70 then 4 else 0 end)
         when sc.wind_date is not null then 4 else 0 end)
    + (case
         when sc.roof_basis <> 'built' or sc.roof_basis is null then 0
         when extract(year from current_date)::int - sc.year_built between 15 and 30 then 18
         when extract(year from current_date)::int - sc.year_built > 30 then 5
         else 0 end)
    + (case when sc.absentee then -12 else 6 end)
    + (case when sc.value >= 500000 then 4 when sc.value >= 300000 then 2 else 0 end)
    as score
  from scored sc
  where sc.dist_mi <= p_miles
    and coalesce(sc.status, '') <> 'converted'
)
select
  src, target_id, county, address,
  regexp_replace(trim(split_part(address, ',', 1)), '\s+', ' ', 'g') as street,
  coalesce(nullif(trim(city), ''), initcap(county) || ' County') as city,
  zip, owner_name, mailing, absentee, lat, lon,
  round(dist_mi::numeric, 2)::double precision, year_built, value,
  hail12_in, hail12_date, wind_kind, wind_date, wind_mph, wind_roof, wind_dist_mi,
  roof_year, roof_basis, last_outcome, last_knock_at, score::int,
  array_remove(array[
    case when hail12_in >= 0.75 then
      'About ' || to_char(hail12_in, 'FM9.0') || ' in hail on radar, ' || to_char(hail12_date, 'Mon FMDD') end,
    case when wind_date >= current_date - 365 then
      case
        when wind_kind = 'tornado' then 'Tornado reported '
        when wind_roof then 'Roof damage reported '
        when wind_kind = 'wind_damage' then 'Wind damage reported '
        else to_char(wind_mph, 'FM999') || ' mph gust reported '
      end || to_char(wind_dist_mi, 'FM0.0') || ' mi away, ' || to_char(wind_date, 'Mon FMDD') end,
    case
      when roof_basis = 'built' and home_age between 15 and 30 then
        'Built ' || year_built || ', no big hail here since 2020: roof may be original'
      when roof_basis = 'built' and home_age > 30 then
        'Built ' || year_built || ', no big hail here since 2020'
      when roof_basis = 'hail' then
        'Golf-ball hail ' || to_char(big_hail_old_date, 'Mon YYYY') || ': roof likely replaced since' end,
    case when absentee then 'Owner lives elsewhere' else 'Owner lives here' end
  ], null) as reasons
from pts
order by score desc, dist_mi asc
limit p_limit;
$$;

comment on function public.doors_near is
  'Ranked doors around a point with plain-language reasons: radar hail at the house, wind or tornado reports nearby, an estimated roof year and whether the owner lives there.';
