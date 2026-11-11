"""Bulk-load a CSV into a Supabase table through PostgREST in batches.
Usage: load_rows.py <table> <csv> <supabase_url> <anon_key>
Needs a temporary anon INSERT (+SELECT) policy on <table>; drop it afterwards."""
import csv, json, sys, requests
table, path, url, key = sys.argv[1:5]
H = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
     "Prefer": "resolution=merge-duplicates,return=minimal"}
def conv(k, v):
    if v == "": return None
    if k in ("r", "c", "big_hail_days", "contractor_permits", "year_built", "imp_value", "mkt_value"): return int(v)
    if k in ("hail12_in", "hail24_in", "mesh_in", "wind_mph", "wind_dist_mi", "lat", "lon"): return float(v)
    if k in ("wind_roof", "contractor_burst"): return v == "true"
    return v
rows = csv.DictReader(open(path)); batch = []; sent = 0
def flush():
    global batch, sent
    if not batch: return
    r = requests.post(f"{url}/rest/v1/{table}", headers=H, data=json.dumps(batch), timeout=120)
    if r.status_code >= 300: sys.exit(f"FAILED {r.status_code}: {r.text[:300]}")
    sent += len(batch); batch = []
for row in rows:
    batch.append({k: conv(k, v) for k, v in row.items()})
    if len(batch) == 5000: flush(); print("sent", sent, flush=True)
flush(); print("done", sent)
