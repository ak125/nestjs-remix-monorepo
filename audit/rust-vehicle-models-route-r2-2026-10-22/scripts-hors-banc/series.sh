#!/usr/bin/env bash
# series.sh <node|rust> <répertoire de rapports> : sélection posée, 9 parcours espacés de 65 s, puis destination de chacun.
set -uo pipefail
sel=$1; dir=$2
W=/home/deploy/worktrees/claude-rust-vehicle-models-20261021/services/vehicle-models-rs
EV=/home/deploy/rust-vehicle-models-20261021-evidence/r2
export ROUTE_OUT=$EV/bench-v3 ROUTE_DATA=$EV/record-v3/recorded.jsonl:$EV/contract-v1/fixtures-users.jsonl:$EV/record-v4/recorded-new.jsonl
B=$W/bench
mkdir -p "$dir"
bash $B/route.sh select "$sel" 2>&1 | tail -1
bash $B/route.sh status
start=$(date +%Y%m%dT%H%M%S)
for j in 164:2008:desktop 140:2008:mobile 108:2018:desktop 173:1995:mobile 128:2008:desktop 441:2018:mobile 140:-:diagnostic 164:-:diagnostic 441:-:diagnostic; do
  IFS=: read m y f <<<"$j"
  sleep 65
  bash $B/route.sh journey https://localhost:3161 "$m" "$y" "$f" 2>&1 | tail -1
done
for f in $(ls $ROUTE_OUT/journeys/*.json | sort); do
  b=$(basename "${f%.json}")
  [[ "$b" > "$start" ]] || continue
  python3 -I $B/contract.py journey-routes "$f" "$sel" "$dir/routes-$b.json" > "$dir/routes-$b.out"
  head -1 "$dir/routes-$b.out"
done
rm -rf $B/__pycache__
