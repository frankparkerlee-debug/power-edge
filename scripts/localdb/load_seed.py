"""Load a production data slice (saved catalog-query output) into the local DB.

Usage: python3 -I load_seed.py <saved tool output .txt> [more files...]
Each file holds one row whose keys are table names and whose values are
json_agg arrays of that table's rows. Keys that are not tables are ignored.
"""
import json, re, subprocess, sys, pathlib

PSQL = ["/opt/homebrew/opt/postgresql@17/bin/psql", "-h", "localhost", "-p", "54322", "-U", "postgres",
        "-d", "poweredge", "-v", "ON_ERROR_STOP=1", "-q"]
out_dir = pathlib.Path(__file__).parent / "data"
out_dir.mkdir(exist_ok=True)

def rows_from(path):
    raw = open(path).read()
    try:
        raw = json.loads(raw).get("result", raw)
    except Exception:
        pass
    m = re.search(r"<untrusted-data-[0-9a-f-]+>\s*(\[.*\])\s*</untrusted-data", raw, re.S)
    return json.loads(m.group(1))[0]

for path in sys.argv[1:]:
    row = rows_from(path)
    for table, data in row.items():
        if not isinstance(data, list):
            continue
        f = out_dir / f"{table}.json"
        f.write_text(json.dumps(data))
        sql = (f"insert into public.{table} overriding system value "
               f"select * from json_populate_recordset(null::public.{table}, $seed${json.dumps(data)}$seed$::json) "
               f"on conflict do nothing;")
        subprocess.run(PSQL, input=sql, text=True, check=True)
        n = subprocess.run(PSQL + ["-Atc", f"select count(*) from public.{table}"], text=True, capture_output=True).stdout.strip()
        print(f"{table}: +{len(data)} rows (now {n})")
