#!/usr/bin/env bash
set -uo pipefail
S=/tmp/claude-1000/-opt-automecanik-app/a498c95f-8b74-4d1b-b66d-34666b3abc74/scratchpad/bench
D=$S/diag-v2
B=/home/deploy/worktrees/claude-rust-vehicle-models-20261021/services/vehicle-models-rs/bench/bench.sh
for lat in 0 20; do
  ( while [ ! -s $D/pids/rust.pid ]; do sleep 0.2; done; p=$(cat $D/pids/rust.pid); sleep 16;
    python3 -I $S/diag-snap.py $p > $D/snap-L$lat-a.json; sleep 20;
    python3 -I $S/diag-snap.py $p > $D/snap-L$lat-b.json ) &
  BENCH_ENV_FILE=/opt/automecanik/app/backend/.env BENCH_OUT=$D bash $B load C $lat diag2 30 >/dev/null 2>&1
  wait
done
