"""Summarize radar hail + NWS wind reports per ~1 km cell (0.01 deg) over North Texas.
Cell (r, c): center lat = 33.545 - 0.01 r, center lon = -98.145 + 0.01 c.
Hail uses a 3x3 max around each cell to allow for radar position error."""
import csv, json, sys, math, datetime, collections, numpy as np
SP = sys.argv[1]; TODAY = datetime.date.fromisoformat(sys.argv[2])
NR, NC = 165, 240
D12 = TODAY - datetime.timedelta(days=365); D24 = TODAY - datetime.timedelta(days=730)
by_date = collections.defaultdict(list)
for d, r, c, mm in csv.reader(open(f"{SP}/mesh/hail_cells.csv")):
    by_date[d].append((int(r), int(c), float(mm)))
z = lambda: np.zeros((NR, NC), np.float32)
h12, h24 = z(), z(); h12d = np.full((NR, NC), "", object); h24d = np.full((NR, NC), "", object)
big_old = np.full((NR, NC), "", object); big_n = np.zeros((NR, NC), np.int16)
for d in sorted(by_date):
    g = z()
    for r, c, mm in by_date[d]: g[r, c] = mm
    p = np.pad(g, 1); g3 = np.max([p[i:i+NR, j:j+NC] for i in range(3) for j in range(3)], axis=0) / 25.4
    day = datetime.date.fromisoformat(d)
    if day >= D12:
        m = g3 > h12; h12[m] = g3[m]; h12d[m] = d
    elif day >= D24:
        m = g3 > h24; h24[m] = g3[m]; h24d[m] = d
    big = g3 >= 1.75; big_n[big] += 1
    if day < D12: big_old[big] = d  # dates ascend, so this ends on the latest
# wind: strongest report within 1 mile of each cell center, last 24 months
rank = {"TORNADO": 4}
W = json.load(open(f"{SP}/wind/wind_reports.json"))
W = [w for w in W if datetime.date.fromisoformat(w[0]) >= D24]
def strength(w):
    roof = any(k in w[6].lower() for k in ("roof", "shingle", "home", "house", "residence", "structur"))
    s = rank.get(w[1], 0) + (2 if roof else 0) + (1 if (w[2] or 0) >= 70 else 0) + (1 if "DMG" in w[1] else 0)
    return s, roof
rows = 0
with open(f"{SP}/mesh/cell_signals.csv", "w", newline="") as fo:
    out = csv.writer(fo)
    out.writerow(["r","c","hail12_in","hail12_date","hail24_in","hail24_date","big_hail_old_date","big_hail_days","wind_date","wind_kind","wind_mph","wind_roof","wind_dist_mi","wind_place","computed_on"])
    for r in range(NR):
        lat = 33.545 - 0.01 * r
        for c in range(NC):
            lon = -98.145 + 0.01 * c
            best = None
            for w in W:
                dy = (w[3] - lat) * 69.0; dx = (w[4] - lon) * 69.0 * math.cos(math.radians(lat))
                dist = math.hypot(dx, dy)
                if dist > 1.0: continue
                s, roof = strength(w)
                key = (datetime.date.fromisoformat(w[0]) >= D12, s, -dist)
                if best is None or key > best[0]: best = (key, w, roof, dist)
            has_hail = h12[r, c] >= 0.75 or h24[r, c] >= 0.75 or big_old[r, c] or big_n[r, c]
            if not (has_hail or best): continue
            kind = None
            if best:
                kind = {"TORNADO": "tornado", "TSTM WND DMG": "wind_damage", "NON-TSTM WND DMG": "wind_damage"}.get(best[1][1], "wind_gust")
            out.writerow([r, c,
                round(float(h12[r, c]), 2) if h12[r, c] >= 0.75 else "", h12d[r, c] if h12[r, c] >= 0.75 else "",
                round(float(h24[r, c]), 2) if h24[r, c] >= 0.75 else "", h24d[r, c] if h24[r, c] >= 0.75 else "",
                big_old[r, c], int(big_n[r, c]),
                best[1][0] if best else "", kind or "", best[1][2] if best and best[1][2] else "",
                ("true" if best[2] else "false") if best else "", round(best[3], 2) if best else "",
                (best[1][5] or "")[:60] if best else "", TODAY.isoformat()])
            rows += 1
print("cells written:", rows)
print("cells with 1in+ hail last 12mo:", int((h12 >= 1).sum()), " 1.75in+:", int((h12 >= 1.75).sum()))
print("cells with golf-ball hail older than 12mo (roof likely replaced since):", int((big_old != "").sum()))
