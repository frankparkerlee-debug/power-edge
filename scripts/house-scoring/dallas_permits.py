"""Dallas residential re-roof permits -> reroof_permits.csv for public.reroof_permits.

Steps (run from a scratch folder):
  1. curl -s -G "https://www.dallasopendata.com/resource/e7gq-4sah.json" \
       --data-urlencode "$where=permit_type='Residential Roofing Permit'" \
       --data-urlencode "$limit=50000" -o dallas_roof.json
  2. python dallas_permits.py geo-in      # writes geo_in.csv
  3. curl -s --form addressFile=@geo_in.csv --form benchmark=Public_AR_Current \
       https://geocoding.geo.census.gov/geocoder/locations/addressbatch -o geo_out.csv
  4. python dallas_permits.py build       # writes reroof_permits.csv
Dallas stopped filling in the contractor after 2025-09-17, so roofer stats end there.
"""
import csv, datetime, json, re, sys
from collections import defaultdict

norm = lambda a: re.sub(r"\s+", " ", a.split(",")[0].strip().upper())
iso = lambda s: datetime.date(2000 + int(s.split("/")[2]), int(s.split("/")[0]), int(s.split("/")[1]))
rows = json.load(open("dallas_roof.json"))

if sys.argv[1] == "geo-in":
    with open("geo_in.csv", "w", newline="") as f:
        w = csv.writer(f)
        for i, r in enumerate(rows):
            a = (r.get("street_address") or "").split(",")[0].strip()
            if a:
                w.writerow([i, a, "Dallas", "TX", (r.get("zip_code") or "")[:5]])
    sys.exit()

# Per-roofer history: how many permits, first/last, and whether 80%+ landed in one 90-day burst.
by = defaultdict(list)
for r in rows:
    c = re.sub(r"\s+", " ", (r.get("contractor") or "").strip().upper())
    if c:
        by[c].append(iso(r["issued_date"]))
stats = {}
for c, ds in by.items():
    ds.sort()
    best = max(sum(1 for x in ds if 0 <= (x - s).days <= 90) for s in ds)
    stats[c] = (len(ds), ds[0], ds[-1], len(ds) >= 5 and best / len(ds) >= 0.8)

geo = {}
for rec in csv.reader(open("geo_out.csv")):
    if len(rec) >= 6 and rec[2] == "Match":
        lon, lat = rec[5].split(",")
        geo[int(rec[0])] = (float(lat), float(lon))

with open("reroof_permits.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["permit_number", "city", "issued_date", "street", "zip", "lat", "lon", "contractor",
                "contractor_permits", "contractor_first", "contractor_last", "contractor_burst", "work"])
    n = 0
    for i, r in enumerate(rows):
        if i not in geo:
            continue
        c = re.sub(r"\s+", " ", (r.get("contractor") or "").strip().upper())
        s = stats.get(c)
        w.writerow([r["permit_number"], "dallas", iso(r["issued_date"]).isoformat(), norm(r["street_address"]),
                    (r.get("zip_code") or "")[:5], round(geo[i][0], 6), round(geo[i][1], 6), c,
                    s[0] if s else "", s[1].isoformat() if s else "", s[2].isoformat() if s else "",
                    ("true" if s[3] else "false") if s else "", (r.get("work_description") or "")[:200]])
        n += 1
print("permits with a location:", n)
