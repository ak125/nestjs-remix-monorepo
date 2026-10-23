#!/usr/bin/env bash
# Diagnostic hors protocole : connexions TCP ouvertes et changements de contexte du service Rust (C) à L0 et L20.
set -uo pipefail
S=/tmp/claude-1000/-opt-automecanik-app/a498c95f-8b74-4d1b-b66d-34666b3abc74/scratchpad/bench
D=$S/diag-v2
B=/home/deploy/worktrees/claude-rust-vehicle-models-20261021/services/vehicle-models-rs/bench/bench.sh
for lat in 0 20; do
  nstat -n >/dev/null
  ( while [ ! -s $D/pids/rust.pid ]; do sleep 0.2; done; p=$(cat $D/pids/rust.pid); sleep 16;
    grep -E 'ctxt|Threads' /proc/$p/status > $D/ctx-L$lat-a.txt; sleep 20;
    grep -E 'ctxt|Threads' /proc/$p/status > $D/ctx-L$lat-b.txt ) &
  BENCH_ENV_FILE=/opt/automecanik/app/backend/.env BENCH_OUT=$D bash $B load C $lat diag 30 >/dev/null 2>&1
  wait
  nstat -z TcpActiveOpens TcpPassiveOpens > $D/nstat-L$lat.txt
  echo "L$lat"; cat $D/nstat-L$lat.txt | grep -E 'Tcp'; cat $D/ctx-L$lat-a.txt $D/ctx-L$lat-b.txt
  python3 -I -c "import json;d=json.load(open('$D/runs/C-L$lat-diag/load.json'));print({k:d[k] for k in ('requests','rps') if k in d})"
done
