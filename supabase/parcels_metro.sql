-- Every single-family home in Dallas and Tarrant counties, for Best doors.
--
-- Kept OUT of public.parcels on purpose: the hourly storm-target job reads
-- parcels by lat/lon box and already gets Dallas and Tarrant from the live
-- DCAD and TAD services, so adding them there would double its hits.
-- Only public.doors_near reads this table.
--
-- Sources (free, public), built by scripts/house-scoring/metro_parcels.py:
--   Geometry, owner, situs, mailing: TxGIO StratMap 2026 land parcels
--     (collection 1d33dafb-6e9c-40ac-887d-f4577909ed9b, files 48113 and 48439)
--   Dallas year built, values, state code: DCAD 2026 certified data
--     (RES_DETAIL, main building = largest living area; ACCOUNT_APPRL_YEAR)
--   Tarrant city and ZIP: filled from public.tarrant_roll by pidn after load
-- Kept: state code A*, improvement value over $25k, a street address and owner.
create table if not exists public.parcels_metro (
  county text not null,              -- dallas | tarrant
  prop_id text not null,             -- DCAD account / TAD pidn
  owner text,
  situs text,                        -- "STREET, CITY, TX ZIP" (parts omitted when unknown)
  city text,
  zip text,
  mail text,
  land_use text,
  year_built int,
  imp_value bigint,
  mkt_value bigint,
  lat double precision not null,
  lon double precision not null,
  primary key (county, prop_id)
);
create index if not exists parcels_metro_lat_lon_idx on public.parcels_metro (lat, lon);
comment on table public.parcels_metro is
  'Single-family homes in Dallas and Tarrant (StratMap 2026 + DCAD 2026). Read only by doors_near; never by the storm-target job.';
alter table public.parcels_metro enable row level security;

-- Tarrant city and ZIP, filled from tarrant_roll after the load. The roll pads
-- pidn with dashes ("--515---16---13") and StratMap sometimes doubles them
-- ("50--1"), so both sides are normalized. Run per first character of
-- prop_id (1, 2, 3, 4, then 5-9 and A) to keep each update small; a single
-- whole-table update right after the bulk load filled the disk on 2026-11-11.
-- Result 2026-11-11: 554,536 of 582,175 Tarrant homes matched (95%).
--
--   with roll as (
--     select distinct on (k) k, city, mail_addr, mail_zip from (
--       select regexp_replace(trim(both '-' from pidn), '-+', '-', 'g') as k,
--              city, mail_addr, mail_zip, account
--       from public.tarrant_roll) x
--     where left(k, 1) = '<prefix>'
--     order by k, account)
--   update public.parcels_metro m
--   set city = nullif(r.city, ''),
--       zip = case when upper(trim(r.mail_addr)) = upper(trim(m.situs))
--                  then nullif(left(r.mail_zip, 5), '') end,
--       situs = m.situs
--         || case when coalesce(r.city, '') <> '' then ', ' || upper(r.city) else '' end
--         || case when upper(trim(r.mail_addr)) = upper(trim(m.situs)) and coalesce(r.mail_zip, '') <> ''
--                 then ', TX ' || left(r.mail_zip, 5) else '' end
--   from roll r
--   where m.county = 'tarrant' and left(m.prop_id, 1) = '<prefix>'
--     and r.k = regexp_replace(trim(both '-' from m.prop_id), '-+', '-', 'g')
--     and position(',' in m.situs) = 0;
--   vacuum analyze public.parcels_metro;
--
-- Load in pieces of about 275k rows; PostgREST's 3 s statement timeout
-- cancels 5,000-row batches once the table is large, so use BATCH=2000.
