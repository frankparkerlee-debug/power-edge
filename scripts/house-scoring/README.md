# House scoring data

Builds the two tables behind `/admin/doors` (`public.doors_near`):

- `hail_days`: radar hail per ~1 km cell per local storm day since 2020-10-14
- `cell_signals`: per cell, the last 12 and 12 to 24 months of hail, the last
  golf-ball hail older than a year (roof-age inference), and the strongest NWS
  wind or tornado report within a mile

Schema and the ranking function: `supabase/house_scoring.sql`.

## Sources (free, no keys)

- Hail: NOAA MRMS MESH, `MESH_Max_1440min_00.50` on the NOAA AWS bucket
  `noaa-mrms-pds`. Each file is a 24-hour max; the 12:00Z file on day D+1
  covers 7am to 7am Central starting on local day D, so rows carry local dates.
  MESH is a radar estimate and tends to run large. It is never shown as a
  measurement.
- Wind: NWS Local Storm Reports via Iowa Environmental Mesonet
  (`/geojson/lsr.geojson?wfos=FWD`): thunderstorm and non-thunderstorm wind
  damage, tornadoes, and gusts of 58 mph or more.
- Gridded gust analyses (NOAA URMA) were tested against measured gusts on
  2026-04-25 and missed all of them (89 mph showed as 40), so they are not used.

## Refresh

Needs Python 3 with `eccodes`, `numpy`, `requests` (a venv is fine) and curl.
Python's certificate store on macOS can fail on HTTPS, so downloads use curl.

```bash
WORK=/path/to/scratch            # needs mesh/ and wind/ folders
./mesh_all.sh $WORK 2020-10-14 $(date +%F)          # about 15 minutes for 6 years
curl -s -o $WORK/wind/lsr_2y.geojson "https://mesonet.agron.iastate.edu/geojson/lsr.geojson?sts=<2 years ago>T00:00Z&ets=<today>T23:59Z&wfos=FWD"
python wind_reports.py $WORK/wind/lsr_2y.geojson $WORK/wind/wind_reports.json
python cell_signals.py $WORK $(date +%F)
```

Load with `load_rows.py <table> <csv> <supabase_url> <key>`. It upserts in
batches of 5,000. With the anon key it needs a temporary insert/select/update
policy on the target table; drop it right after.

`cell_signals` windows ("last 12 months") are relative to `computed_on`, so
rerun it at least monthly, and after any new hail.

## Dallas re-roof permits

`dallas_permits.py` documents the steps (Dallas open data, then the Census
batch geocoder, then a CSV for `reroof_permits`). Load it with `load_rows.py`.
Rerun when you want newer permits; roofer names stop after Sept 2025.

## After loading cell_signals

Run the re-dating step at the end of `supabase/house_scoring.sql`. Radar days
run 7am to 7am, so hail that fell after midnight would otherwise show the
previous day, which is not the homeowner's date of loss.

## Daily refresh (automated since 2026-11-11)

The scripts above were the one-time load. The same data now stays current on
its own (supabase/radar_refresh.sql has the details):

- 13:20 and 17:20 UTC: `POST /api/cron/radar-refresh` loads each new day of
  MRMS MESH radar hail into `hail_days` (decoded in Node by `lib/grib2.ts`, no
  eccodes) and the last 3 days of NWS wind/tornado reports into
  `wind_reports`. Re-read a range with `?from=YYYY-MM-DD&days=N`; backfill
  wind with `?wind_days=760`.
- 13:50 and 17:50 UTC: `select public.refresh_cell_signals()` rebuilds
  `cell_signals` from those tables (same rules as cell_signals.py; ties in
  hail size now go to the latest storm) and re-dates hail12_date.
  `select public.refresh_cell_signals(current_date, false)` is a dry run that
  compares against the current table.
- Mondays 15:30 UTC: `POST /api/cron/permits-refresh` adds new City of Dallas
  re-roof permits (geocoded with the Census geocoder).
- `radar_days` lists every radar day loaded (cells = -1: NOAA never published
  the file).
