-- The knock map's doors: public.doors_near (storm targets, county records,
-- Dallas permits) plus what the CRM knows about each door.
--
-- Views (p_view):
--   'hail'  (default) doors with radar hail of p_min_hail inches or more
--           (null = every door; the add-a-door lookup uses that)
--   'older' homes built 15 to 30 years ago with no sign of a newer roof
--           (roof_original, below). Homes over 30 are left out because they
--           have likely been re-roofed once already and we cannot tell when.
--   'priority' only priority doors (below), whatever the hail size.
--
-- Per door it also works out (Parker, 2026-11-11: call out the signals and
-- make old roofs with storm damage, or several storms, a priority knock):
--   roof_original   built 15 to 30 years ago and no newer roof on record. In
--                   the City of Dallas that means no re-roof permit (permits
--                   start Oct 2020); elsewhere, no golf-ball radar hail since
--                   2020 either (doors_near's roof_basis = 'built').
--   storm_days      storms at the house in the last 24 months since its roof
--                   was last replaced (as far as we know): radar hail days of
--                   1.25 in+ (3x3 cells, like hail12) plus a damaging wind
--                   report within 1 mi (tornado, wind damage, roof damage or
--                   70 mph+) when it fell on another day. At 1 in, half of
--                   North Richland Hills and Frisco had two "storms" in two
--                   years, so the bar is 1.25 in.
--   no_permit_since City of Dallas only: the storm date (1.25 in+ hail this
--                   past year, or older golf-ball hail) when no re-roof permit
--                   has been filed since it.
--   priority        a storm in the last 12 months (still inside the usual
--                   1-year claim window: Tex. Ins. Code 2301.010(c) lets a
--                   policy require filing within a year of the loss), and
--                   either roof_original or 2+ storm_days. Older storms alone
--                   are likely cash jobs, so they do not make a door priority
--                   (Parker, 2026-11-11).
-- Doors we have worked (any knock, or a job) show in every view, so a rep
-- sees the neighbors who signed and the ones who said no.
--
-- p_order: 'dist' (nearest first), 'hail' (biggest hail first, for a ZIP) or
-- 'score' (priority doors, then doors_near's best-door score). At most 1,000 rows; total
-- says how many matched.
--
-- Called only by app/api/field/doors with the service key.
drop function if exists public.field_doors(double precision, double precision, double precision, real, text, text, integer);
drop function if exists public.field_doors(double precision, double precision, double precision, real, text, text, integer, text);
-- (the drop above also removes the 2026-11-11 first cut of this version)

create function public.field_doors(
  p_lat double precision,
  p_lon double precision,
  p_miles double precision default 1,
  p_min_hail real default 2,
  p_zip text default null,
  p_order text default 'dist',
  p_limit integer default 1000,
  p_view text default 'hail'
)
returns table(
  src text, target_id uuid, county text, address text, city text, zip text,
  owner_name text, absentee boolean, lat double precision, lon double precision,
  dist_mi double precision, year_built integer, value bigint, hail_in real,
  hail_date date, storm_date date, wind_kind text, wind_date date, wind_roof boolean,
  wind_dist_mi real, roof_year integer, roof_basis text, permit_date date, roofer text,
  recent_roof boolean, reasons text[], score integer,
  wind_mph real, big_hail_old_date date, storm_days date[], roof_original boolean,
  no_permit_since date, priority boolean,
  phone text, phone_dnc boolean,
  last_outcome text, last_knock_at timestamptz, last_rep text, last_note text,
  follow_up_at timestamptz, job_id uuid, job_stage text, appt_at timestamptz,
  appt_status text, total bigint
)
language sql
stable
set search_path to ''
as $function$
with m as (
  select least(greatest(coalesce(p_miles, 1), 0.1), 3) as mi,
         extract(year from current_date)::int as yr
),
worked_jobs as (
  select distinct j.storm_target_id from public.jobs j where j.storm_target_id is not null
),
job_keys as (
  select distinct public.norm_street(split_part(j.address, ',', 1)) as nkey
  from public.jobs j where j.address is not null
),
base as (
  select d.* from m, public.doors_near(p_lat, p_lon, m.mi, 20000) d
  where (p_zip is null or left(d.zip, 5) = p_zip)
),
cells as (
  select distinct public.cell_r(b.lat) as r, public.cell_c(b.lon) as c from base b
),
cell_storms as (
  -- Radar hail days of 1.25 in+ in the last 24 months, 3x3 cells like hail12.
  select cl.r, cl.c, array_agg(distinct h.local_date) as days
  from cells cl
  join public.hail_days h
    on h.r between cl.r - 1 and cl.r + 1 and h.c between cl.c - 1 and cl.c + 1
   and h.mesh_in >= 1.25 and h.local_date >= current_date - 730
  group by cl.r, cl.c
),
sig as (
  select b.*, s.big_hail_old_date, coalesce(cs.days, '{}'::date[]) as days,
    upper(trim(b.city)) = 'DALLAS' as dallas_city,
    -- When the roof was last replaced, as far as we know. In the City of
    -- Dallas a permit is required, so golf-ball hail alone does not count.
    case when upper(trim(b.city)) = 'DALLAS' then b.permit_date
         else greatest(b.permit_date, s.big_hail_old_date) end as roof_since,
    b.year_built between m.yr - 30 and m.yr - 15
      and case when upper(trim(b.city)) = 'DALLAS' then b.permit_date is null
               else b.roof_basis = 'built' end as roof_original,
    (b.wind_kind in ('tornado', 'wind_damage') or coalesce(b.wind_roof, false)
      or coalesce(b.wind_mph, 0) >= 70) as wind_dmg
  from base b
  cross join m
  left join public.cell_signals s on s.r = public.cell_r(b.lat) and s.c = public.cell_c(b.lon)
  left join cell_storms cs on cs.r = public.cell_r(b.lat) and cs.c = public.cell_c(b.lon)
),
sig1 as (
  select g.*,
    (coalesce(g.hail_in, 0) >= 1.25 or (g.wind_dmg and g.wind_date >= current_date - 365)) as storm12
  from sig g
),
sig2 as (
  select g.*,
    array(
      -- A radar day within a day of the door's hail date takes that date, so
      -- the list matches the hail line (radar days run 7am to 7am).
      select distinct case when g.hail_date is not null and abs(x.d - g.hail_date) <= 1
                           then g.hail_date else x.d end
      from unnest(g.days) as x(d)
      where g.roof_since is null or x.d > g.roof_since
      union
      select g.wind_date
      where g.wind_dmg and g.wind_date >= current_date - 730
        and (g.roof_since is null or g.wind_date > g.roof_since)
        and not exists (select 1 from unnest(g.days) as y(d) where abs(y.d - g.wind_date) <= 1)
      order by 1
    ) as storm_days,
    case when g.dallas_city then
      case when coalesce(g.hail_in, 0) >= 1.25 and (g.permit_date is null or g.permit_date < g.hail_date)
             then g.hail_date
           when g.big_hail_old_date is not null
            and (g.permit_date is null or g.permit_date < g.big_hail_old_date)
             then g.big_hail_old_date
      end
    end as no_permit_since
  from sig1 g
),
near as (
  select n.*, (n.storm12 and (n.roof_original or cardinality(n.storm_days) >= 2)) as priority
  from sig2 n, m
  where
    n.last_outcome is not null
    or (n.target_id is not null
        and exists (select 1 from worked_jobs w where w.storm_target_id = n.target_id))
    or public.norm_street(split_part(n.address, ',', 1)) in (select nkey from job_keys)
    or case coalesce(p_view, 'hail')
         when 'older' then n.roof_original
         when 'priority' then n.storm12 and (n.roof_original or cardinality(n.storm_days) >= 2)
         else (p_min_hail is null or n.hail_in >= p_min_hail)
       end
),
conv as (
  select t.id as target_id, t.county, upper(trim(t.address)) as address, t.city, t.zip,
    t.owner_name, coalesce(t.absentee, false) as absentee, t.lat, t.lon,
    3958.8 * 2 * asin(sqrt(
      power(sin(radians(t.lat - p_lat) / 2), 2) +
      cos(radians(p_lat)) * cos(radians(t.lat)) * power(sin(radians(t.lon - p_lon) / 2), 2)
    )) as dist_mi,
    nullif(t.year_built, 0)::int as year_built, t.value::bigint as value,
    t.radar_in as hail_in, t.radar_date as hail_date
  from public.storm_targets_radar t, m
  where t.status = 'converted'
    and t.lat between p_lat - m.mi / 69.0 and p_lat + m.mi / 69.0
    and t.lon between p_lon - m.mi / (69.0 * cos(radians(p_lat)))
                  and p_lon + m.mi / (69.0 * cos(radians(p_lat)))
    and (p_zip is null or left(t.zip, 5) = p_zip)
),
alld as (
  select n.src, n.target_id, n.county, n.address, n.city, n.zip, n.owner_name, n.absentee,
    n.lat, n.lon, n.dist_mi, n.year_built, n.value, n.hail_in, n.hail_date,
    n.wind_kind, n.wind_date, n.wind_roof, n.wind_dist_mi,
    n.roof_year, n.roof_basis, n.permit_date, n.roofer, n.recent_roof, n.reasons, n.score,
    n.wind_mph, n.big_hail_old_date, n.storm_days, n.roof_original, n.no_permit_since, n.priority
  from near n
  union all
  select 'target', c.target_id, c.county, c.address, c.city, c.zip, c.owner_name, c.absentee,
    c.lat, c.lon, c.dist_mi, c.year_built, c.value, c.hail_in, c.hail_date,
    null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, false
  from conv c, m
  where c.dist_mi <= m.mi
),
picked as (
  select a.*, count(*) over () as total
  from alld a
  order by
    case when p_order = 'hail' then -coalesce(a.hail_in, 0) else 0 end,
    case when p_order = 'score' and a.priority then 0 when p_order = 'score' then 1 else 0 end,
    case when p_order = 'score' then -coalesce(a.score, 0) else 0 end,
    a.dist_mi
  limit least(greatest(coalesce(p_limit, 1000), 1), 1000)
),
jb as (
  select j.id, j.stage, j.appointment_id, j.storm_target_id, j.updated_at,
    public.norm_street(split_part(j.address, ',', 1)) as nkey
  from public.jobs j
),
jb_addr as (
  select distinct on (nkey) id, stage, appointment_id, nkey from jb
  where nkey is not null order by nkey, updated_at desc
)
select p.src, p.target_id, p.county, p.address, p.city, p.zip, p.owner_name, p.absentee,
  p.lat, p.lon, p.dist_mi, p.year_built, p.value, p.hail_in, p.hail_date, t.storm_date,
  p.wind_kind, p.wind_date, p.wind_roof, p.wind_dist_mi,
  p.roof_year, p.roof_basis, p.permit_date, p.roofer, p.recent_roof, p.reasons, p.score,
  p.wind_mph, p.big_hail_old_date, p.storm_days, p.roof_original, p.no_permit_since, p.priority,
  case when coalesce(t.phone_dnc, false) then null else t.phone end as phone, t.phone_dnc,
  k.outcome, k.created_at, k.rep, k.note,
  cb.follow_up_at,
  coalesce(j1.id, j2.id), coalesce(j1.stage, j2.stage), ap.slot_start, ap.status,
  p.total
from picked p
left join public.storm_targets t on t.id = p.target_id
left join public.target_last_knock k on k.target_id = p.target_id
left join lateral (
  select kn.follow_up_at from public.knocks kn
  where kn.target_id = p.target_id and kn.outcome = 'come_back'
    and kn.done_at is null and kn.follow_up_at is not null
  order by kn.created_at desc limit 1
) cb on true
left join jb j1 on j1.storm_target_id = p.target_id
left join jb_addr j2 on j1.id is null and j2.nkey = public.norm_street(split_part(p.address, ',', 1))
left join public.appointments ap on ap.id = coalesce(j1.appointment_id, j2.appointment_id);
$function$;

revoke all on function public.field_doors(double precision, double precision, double precision, real, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.field_doors(double precision, double precision, double precision, real, text, text, integer, text) to service_role;

notify pgrst, 'reload schema';
