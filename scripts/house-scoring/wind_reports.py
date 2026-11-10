"""Filter an IEM Local Storm Report GeoJSON down to roof-relevant wind reports
over North Texas, with LOCAL (Central) dates. Writes wind_reports.json for
cell_signals.py: [local_date, type, mph, lat, lon, city, remark].
Usage: wind_reports.py <lsr.geojson> <out.json>"""
import json, sys, datetime, zoneinfo
src, out = sys.argv[1], sys.argv[2]
tz = zoneinfo.ZoneInfo("America/Chicago")
keep = []
for f in json.load(open(src))["features"]:
    p = f["properties"]; lon, lat = f["geometry"]["coordinates"]
    if not (31.90 <= lat <= 33.55 and -98.15 <= lon <= -95.75):
        continue
    tt = (p.get("typetext") or "").upper()
    damage = tt in ("TSTM WND DMG", "NON-TSTM WND DMG", "TORNADO")
    gust = tt in ("TSTM WND GST", "NON-TSTM WND GST") and (p.get("magf") or 0) >= 58
    if not (damage or gust):
        continue
    v = datetime.datetime.fromisoformat(p["valid"].replace("Z", "+00:00")).astimezone(tz)
    keep.append((v.date().isoformat(), tt, p.get("magf"), round(lat, 4), round(lon, 4),
                 p.get("city") or "", (p.get("remark") or "")[:200]))
json.dump(keep, open(out, "w"))
print("wind/tornado reports kept:", len(keep))
