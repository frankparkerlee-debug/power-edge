"""Dallas + Tarrant single-family homes -> metro_parcels.csv for public.parcels_metro.
Usage: metro_parcels.py <dallas.shp> <tarrant.shp> <dcad_dir> <out.csv>
Dallas: StratMap 2026 parcels (geometry, owner, situs, mail) + DCAD 2026 certified
RES_DETAIL (year built) and ACCOUNT_APPRL_YEAR (values, state code). Tarrant: StratMap only."""
import csv, re, sys
import numpy as np, shapely
from pyogrio.raw import read

dallas_shp, tarrant_shp, dcad_dir, out_path = sys.argv[1:5]
clean = lambda s: re.sub(r"\s+", " ", str(s or "")).strip()

def points(geom):
    g = shapely.from_wkb(geom)
    c = shapely.centroid(g)
    return shapely.get_y(c), shapely.get_x(c)

# --- DCAD side tables (Dallas) ---
year, roof = {}, {}
with open(f"{dcad_dir}/RES_DETAIL.CSV", newline="", encoding="latin-1") as f:
    r = csv.DictReader(f)
    best = {}
    for row in r:
        a = row["ACCOUNT_NUM"]; sf = float(row["TOT_LIVING_AREA_SF"] or 0)
        if a not in best or sf > best[a]:  # main building = largest living area
            best[a] = sf
            try: year[a] = int(row["YR_BUILT"])
            except ValueError: pass
vals = {}
with open(f"{dcad_dir}/ACCOUNT_APPRL_YEAR.CSV", newline="", encoding="latin-1") as f:
    r = csv.reader(f); head = next(r)
    i_imp, i_tot = head.index("IMPR_VAL"), head.index("TOT_VAL")
    i_sptd = head.index("SPTD_CODE") if "SPTD_CODE" in head else len(head) - 1
    for row in r:
        try: vals[row[0]] = (int(float(row[i_imp] or 0)), int(float(row[i_tot] or 0)), row[i_sptd].strip())
        except (ValueError, IndexError): pass
print("dcad: year for", len(year), "accounts; values for", len(vals))

out = open(out_path, "w", newline=""); w = csv.writer(out)
w.writerow(["county","prop_id","owner","situs","city","zip","mail","land_use","year_built","imp_value","mkt_value","lat","lon"])
kept = {"dallas": 0, "tarrant": 0}

# --- Dallas ---
meta, _, geom, cols = read(dallas_shp, columns=["PROP_ID","OWNER_NAME","SITUS_ADDR","SITUS_CITY","SITUS_ZIP","MAIL_ADDR","LOC_LAND_U"])
d = dict(zip(meta["fields"], cols)); lat, lon = points(geom)
for i in range(len(d["PROP_ID"])):
    a = d["PROP_ID"][i]; v = vals.get(a)
    if d["LOC_LAND_U"][i] != "RES" or not v or v[0] <= 25000 or not v[2].startswith("A"): continue
    street = clean(str(d["SITUS_ADDR"][i] or "").split(" ,")[0]).upper()
    owner = clean(d["OWNER_NAME"][i])
    if not street or not owner or np.isnan(lat[i]): continue
    city = clean(re.sub(r"\s*\(DALLAS CO\)", "", str(d["SITUS_CITY"][i] or ""))).title()
    if city.upper() in ("NO TOWN", "NONE"): city = ""
    z = str(d["SITUS_ZIP"][i] or "")[:5]
    situs = street + (f", {city.upper()}" if city else "") + (f", TX {z}" if z else "")
    mail = clean(re.sub(r",?\s*UNITED STATES OF AMERICA\s*$", "", str(d["MAIL_ADDR"][i] or ""))).upper()
    w.writerow(["dallas", a, owner, situs, city, z, mail, v[2], year.get(a, ""), v[0], v[1], round(lat[i], 6), round(lon[i], 6)])
    kept["dallas"] += 1
del d, geom, lat, lon

# --- Tarrant ---
meta, _, geom, cols = read(tarrant_shp, columns=["PROP_ID","OWNER_NAME","SITUS_ADDR","SITUS_CITY","SITUS_ZIP","MAIL_ADDR","STAT_LAND_","YEAR_BUILT","IMP_VALUE","MKT_VALUE"])
d = dict(zip(meta["fields"], cols)); lat, lon = points(geom)
for i in range(len(d["PROP_ID"])):
    lu = str(d["STAT_LAND_"][i] or "").strip().upper()
    imp = int(d["IMP_VALUE"][i] or 0)
    if not lu.startswith("A") or imp <= 25000: continue
    street = clean(d["SITUS_ADDR"][i]).upper(); owner = clean(d["OWNER_NAME"][i])
    if not street or not owner or np.isnan(lat[i]): continue
    try: yb = int(float(d["YEAR_BUILT"][i]))
    except (TypeError, ValueError): yb = ""
    city = clean(d["SITUS_CITY"][i]).title(); z = str(d["SITUS_ZIP"][i] or "")[:5]
    situs = street + (f", {city.upper()}" if city else "") + (f", TX {z}" if z else "")
    mail = clean(re.sub(r",?\s*UNITED STATES OF AMERICA\s*$", "", str(d["MAIL_ADDR"][i] or ""))).upper()
    w.writerow(["tarrant", d["PROP_ID"][i], owner, situs, city, z, mail, lu, yb if yb and yb > 1800 else "",
                imp, int(d["MKT_VALUE"][i] or 0), round(lat[i], 6), round(lon[i], 6)])
    kept["tarrant"] += 1
out.close()
print("kept:", kept)
