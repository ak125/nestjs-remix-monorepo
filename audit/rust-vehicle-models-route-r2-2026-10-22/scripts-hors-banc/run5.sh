#!/usr/bin/env bash
# run5.sh : sondes, budget, panne d'amont et parcours navigateur rejoués sur le binaire de la campagne
# (2aeea4d5…), après le suivi long. Mêmes commandes que run3 ; A2 inchangé. Ne lance rien si run5 existe.
set -uo pipefail
W=/home/deploy/worktrees/claude-rust-vehicle-models-20261021/services/vehicle-models-rs
EV=/home/deploy/rust-vehicle-models-20261021-evidence/r2
B=$W/bench; R=$EV/contract-20261022/run3; R5=$EV/contract-20261022/run5
S=/tmp/claude-1000/-opt-automecanik-app/<session>/scratchpad
D2=$EV/record-v3/recorded.jsonl:$EV/contract-v1/fixtures-users.jsonl
D3=$D2:$EV/record-v4/recorded-new.jsonl
export ROUTE_OUT=$EV/bench-v3
[ -e "$R5" ] && { echo "run5 existe déjà"; exit 1; }
mkdir -p "$R5"
cd "$W" || exit 1
git rev-parse HEAD > "$R5/head.txt"
sha256sum target/release/vehicle-models-route > "$R5/binary.sha256"
grep -q '^2aeea4d5ee2de164' "$R5/binary.sha256" || { echo "binaire différent de la campagne"; exit 1; }
pause() { python3 -I -c "import time;time.sleep($1)"; }

echo "== up"
ROUTE_DATA=$D2 bash $B/route.sh up > "$R5/up.out" 2>&1; echo "up rc=$?"; tail -1 "$R5/up.out"
for p in $(cat $ROUTE_OUT/pids/r2.pid); do echo "r2 $p $(sha256sum /proc/$p/exe | cut -c1-16)"; done | tee "$R5/r2-exe.txt"

echo "== sondes (ns 62)"
ROUTE_DATA=$D2 bash $B/route.sh reset rust > "$R5/reset-r2-probes.out" 2>&1; tail -1 "$R5/reset-r2-probes.out"
pause 10
ROUTE_DATA=$D2 CONTRACT_LOG=r2 python3 -I $B/contract.py probes caddy https://localhost:3161 "$R5/r2-caddy-probes" 62 2>&1 | tail -4
python3 -I $B/contract.py diff "$R/a2-caddy-probes2" "$R5/r2-caddy-probes" "$R5/diff-probes.json" 2>&1 | tail -5
python3 -I $B/contract.py routes "$R5/r2-caddy-probes" rust "$R5/routes-r2-probes.json" 2>&1 | tail -3

echo "== panne d'amont (ns 63)"
ROUTE_DATA=$D2 bash $B/route.sh reset rust > "$R5/reset-r2-backend.out" 2>&1; tail -1 "$R5/reset-r2-backend.out"
pause 10
ROUTE_DATA=$D2 python3 -I $B/contract.py backend-outage rust https://localhost:3161 "$R5/r2-backend-outage" 63 2>&1 | tail -15
python3 -I -c '
import json,sys
j=json.load(open(sys.argv[1]))
print("sélection", j["sélection"], "arrêté", j["arrêté"], "échecs", j["échecs"])
for st in j["étapes"]:
    if "response" in st: print("  ", st["id"], st["response"].get("status"), [c[1] for c in st["caddy"]], len(st["lignes_a2"]), len(st["lignes_r2"]), st["problèmes"])
' "$R5/r2-backend-outage/backend-outage.json"

echo "== pannes Redis et base (ns 64), contre a2-caddy-outages-e (ns 46) comme diff-outages-g"
ROUTE_DATA=$D2 bash $B/route.sh reset rust > "$R5/reset-r2-outages.out" 2>&1; tail -1 "$R5/reset-r2-outages.out"
pause 10
ROUTE_DATA=$D2 CONTRACT_LOG=r2 python3 -I $B/contract.py outages caddy https://localhost:3161 "$R5/r2-caddy-outages" 64 2>&1 | grep -v "^o-" | tail -2
python3 -I $B/contract.py diff-outages "$R/a2-caddy-outages-e" "$R5/r2-caddy-outages" 46 64 "$R5/diff-outages.json" 2>&1 | tail -6
python3 -I -c '
import json,sys
for f in sys.argv[1:]:
    j=json.load(open(f)); print(f.rsplit("/",1)[1], [(e["id"], sorted(k for k in e if k!="id")) for e in j["écarts"]])
' "$R/diff-outages-g.json" "$R5/diff-outages.json"

echo "== budget (ns 179)"
ROUTE_DATA=$D3 bash $B/route.sh reset rust 2>&1 | tail -1
bash $B/route.sh status
ROUTE_DATA=$D3 python3 -I $B/contract.py budget rust https://localhost:3161 "$R5/budget-rust" 179 2>&1 | tail -3
mkdir -p "$R5/budget-rust/logs" && cp -p $ROUTE_OUT/logs/*.log "$R5/budget-rust/logs/"

echo "== parcours navigateur"
ROUTE_DATA=$D3 bash $B/route.sh reset node > "$R5/reset-journeys.out" 2>&1; tail -1 "$R5/reset-journeys.out"
bash $S/series.sh node "$R5/journeys-node"
ROUTE_DATA=$D3 bash $B/route.sh reset rust > "$R5/reset-journeys-rust.out" 2>&1; tail -1 "$R5/reset-journeys-rust.out"
bash $S/series.sh rust "$R5/journeys-rust"

echo "== retour sur node"
bash $B/route.sh select node 2>&1 | tail -1
bash $B/route.sh status
rm -rf "${B:?}/__pycache__"
echo "run5 fini"
