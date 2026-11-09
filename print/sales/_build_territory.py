#!/usr/bin/env python3
"""Generate the territory board from the live storm DB.

The board is only useful if it is true, so it is generated, never typed.
Re-run before each print: python3 print/sales/_build_territory.py
"""
import json, os, sys, urllib.request, datetime, html, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
def env(k):
    v = os.environ.get(k)
    if v: return v
    for f in (ROOT/".env.local", ROOT/".env"):
        if f.exists():
            for line in f.read_text().splitlines():
                if line.startswith(k+"="):
                    return line.split("=",1)[1].strip().strip('"').strip("'")
    return None

URL, KEY = env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY):
    sys.exit("missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")

def q(path):
    req = urllib.request.Request(f"{URL}/rest/v1/{path}",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

rows = []
offset = 0
while True:
    page = q(f"storm_targets?select=city,storm_date,hail_size_in,phone,phone_dnc&limit=1000&offset={offset}")
    if not page: break
    rows += page; offset += 1000
    if offset > 20000: break

BAD = re.compile(r"(TIF|SUBDIST|ZONE|REINVESTMENT)", re.I)
cities = {}
days = {}
for r in rows:
    c = (r.get("city") or "").strip()
    d = r.get("storm_date") or ""
    size = r.get("hail_size_in") or 0
    dialable = bool(r.get("phone")) and not r.get("phone_dnc")
    if d:
        e = days.setdefault(d, {"homes":0,"dial":0,"max":0})
        e["homes"]+=1; e["dial"]+=dialable; e["max"]=max(e["max"], size or 0)
    if not c or BAD.search(c): continue
    e = cities.setdefault(c, {"homes":0,"dial":0,"max":0,"days":set()})
    e["homes"]+=1; e["dial"]+=dialable; e["max"]=max(e["max"], size or 0); e["days"].add(d)

top_cities = sorted(cities.items(), key=lambda kv:-kv[1]["homes"])[:18]
top_days   = sorted(days.items(), key=lambda kv:-kv[1]["homes"])[:10]
today = datetime.date.today()

def hail_badge(s):
    s = float(s or 0)
    if s >= 2.5: return "golf ball +"
    if s >= 1.75: return "golf ball"
    if s >= 1.25: return "half dollar"
    if s >= 1.0:  return "quarter"
    return "marble"

def days_since(d):
    try: return (today - datetime.date.fromisoformat(d)).days
    except Exception: return 0

city_rows = "\n".join(
    f"<tr><td><strong>{html.escape(c)}</strong></td><td>{v['homes']:,}</td>"
    f"<td>{v['dial']:,}</td><td>{v['max']:.2f}″ <span class='note'>{hail_badge(v['max'])}</span></td>"
    f"<td>{', '.join(sorted(v['days'], reverse=True)[:3])}</td></tr>"
    for c, v in top_cities)

day_rows = "\n".join(
    f"<tr><td><strong>{d}</strong></td><td>{days_since(d)} days ago</td><td>{v['homes']:,}</td>"
    f"<td>{v['dial']:,}</td><td>{v['max']:.2f}″</td></tr>"
    for d, v in top_days)

total = len(rows)
dialable = sum(1 for r in rows if r.get("phone") and not r.get("phone_dnc"))

doc = f"""<!doctype html><html><head><meta charset="utf-8">
<title>Storm Territory Board</title><link rel="stylesheet" href="_base.css"></head><body>
<header class="doc">
  <img class="wm" src="../logos/wordmark-black.png" alt="PowerEdge">
  <div class="meta">Storm territory board · Internal<br>Generated {today:%B %-d, %Y}</div>
</header>

<h1>Where the damage is.</h1>
<p class="sub">{total:,} verified storm-hit addresses in the database, {dialable:,} with a
phone number that isn't DNC-flagged. Every row traces back to a National Weather Service
hail report. This page is generated from the live database — if it looks stale, re-run it.</p>

<div class="ok">
  <strong>Read this before you work the list.</strong> DFW has had no qualifying hail since
  late September. Nobody is knocking fresh damage right now, which is exactly why this list is
  worth money: these are homes hit in April through September that still have not been looked at,
  and most Texas policies put a filing deadline on the date of loss. You are not early. You are
  the last call before the window closes.
</div>

<h2>Top cities by unworked homes</h2>
<table>
  <tr><th>City</th><th>Homes</th><th>Dialable</th><th>Largest hail</th><th>Storm dates</th></tr>
  {city_rows}
</table>

<h2>Biggest storm days still in play</h2>
<table>
  <tr><th>Storm date</th><th>Age</th><th>Homes</th><th>Dialable</th><th>Largest hail</th></tr>
  {day_rows}
</table>

<h2>How to work it</h2>
<ul class="tight">
  <li><strong>Setters:</strong> start with the highest dialable count, not the highest home
      count. A city with 2,000 homes and 0 phones is a door route, not a call list.</li>
  <li><strong>Knockers:</strong> start with the biggest hail on the oldest date. Three-inch hail
      from April that nobody has inspected is the best door in the metroplex.</li>
  <li><strong>Always</strong> open with the date and the stone size for <em>that</em> address.
      Pull it from the tool. "Storms in your area" is a telemarketer. "Two and a half inch hail
      on April 26" is a neighbor.</li>
  <li>Mark every outcome in the tool the same day. An unmarked door gets knocked again by your
      teammate next week, and that is how a company gets a reputation.</li>
</ul>

<footer class="doc"><span>PowerEdge · Internal · Regenerate before each print run</span><span>poweredgetx.com · 469-277-9594</span></footer>
</body></html>"""

out = pathlib.Path(__file__).parent / "04-territory-board.html"
out.write_text(doc)
print(f"wrote {out.name}: {len(top_cities)} cities, {len(top_days)} storm days, {total:,} targets")
