# Decode every MESH daily-max file in a folder, keep cells >= 0.75 in over North Texas,
# append rows (local_date, row, col, mm) to the output CSV, delete each file once read.
import sys, os, gzip, glob, numpy as np, eccodes
folder, out = sys.argv[1], sys.argv[2]
R0, R1, C0, C1 = None, None, None, None
with open(out, "a") as fo:
    for f in sorted(glob.glob(os.path.join(folder, "*.gz"))):
        label = os.path.basename(f)[:10]  # local date YYYY-MM-DD
        try:
            gid = eccodes.codes_new_from_message(gzip.decompress(open(f, "rb").read()))
            Ni, Nj = eccodes.codes_get(gid, "Ni"), eccodes.codes_get(gid, "Nj")
            lat0 = eccodes.codes_get(gid, "latitudeOfFirstGridPointInDegrees")
            lon0 = eccodes.codes_get(gid, "longitudeOfFirstGridPointInDegrees") - 360
            g = eccodes.codes_get_values(gid).reshape(Nj, Ni); eccodes.codes_release(gid)
            r0 = int(round((lat0 - 33.545) / 0.01)); c0 = int(round((-98.145 - lon0) / 0.01))
            sub = g[r0:r0 + 165, c0:c0 + 240]
            for r, c in np.argwhere(sub >= 19.05):
                fo.write(f"{label},{r},{c},{sub[r, c]:.1f}\n")
            print(label, "ok", int((sub >= 25.4).sum()))
        except Exception as e:
            print(label, "ERR", e)
        os.remove(f)
