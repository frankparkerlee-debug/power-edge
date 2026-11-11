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
