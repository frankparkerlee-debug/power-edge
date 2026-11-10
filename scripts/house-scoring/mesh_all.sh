#!/bin/bash
# For local date L, the 24h max ending 12:00Z on L+1 covers L 7am to L+1 7am local.
SP=$1; START=$2; END=$3; OUT=$SP/mesh/hail_cells.csv
mkdir -p $SP/mesh/raw
d=$START
while [[ "$d" < "$END" ]]; do
  m=${d:0:7}; list=()
  while [[ "${d:0:7}" == "$m" && "$d" < "$END" ]]; do
    n=$(date -j -v+1d -f %Y-%m-%d $d +%Y%m%d); list+=("$d $n"); d=$(date -j -v+1d -f %Y-%m-%d $d +%Y-%m-%d)
  done
  printf '%s\n' "${list[@]}" | xargs -P 8 -L 1 bash -c '
    L=$0; N=$1; base=https://noaa-mrms-pds.s3.amazonaws.com/CONUS/MESH_Max_1440min_00.50/$N
    if ! curl -sf --retry 3 -o '"$SP"'/mesh/raw/$L.gz $base/MRMS_MESH_Max_1440min_00.50_$N-120000.grib2.gz; then
      k=$(curl -s "https://noaa-mrms-pds.s3.amazonaws.com/?list-type=2&prefix=CONUS/MESH_Max_1440min_00.50/$N/MRMS_MESH_Max_1440min_00.50_$N-12" | grep -oE "<Key>[^<]+</Key>" | head -1 | sed "s/<[^>]*>//g")
      if [ -n "$k" ]; then curl -sf --retry 3 -o '"$SP"'/mesh/raw/$L.gz https://noaa-mrms-pds.s3.amazonaws.com/$k || echo "MISS $L"; else echo "MISS $L"; fi
    fi'
  $SP/venv/bin/python $SP/scripts/mesh_month.py $SP/mesh/raw $OUT | awk '{n++} / ERR /{e++} END{printf "month done: %d files, %d errors\n", n, e}'
  echo "$m complete"
done
echo ALL DONE
