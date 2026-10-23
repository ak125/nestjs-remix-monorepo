#!/usr/bin/env bash
# Banc d'essai hors production du lot vehicle-models-rs : parité puis mesure de
# A (harnais Node, flag éteint), B (flag allumé + Rust) et C (Rust seul).
# Seules `record` et `live` lisent la base, en GET séquentiels ; les autres
# commandes rejouent l'enregistrement (`examples/replay`).
#
# Variables : BENCH_OUT (répertoire de sortie, obligatoire) ; BENCH_ENV_FILE
# (environnement du backend, défaut <dépôt>/backend/.env, chargé sans écraser
# l'existant) ; BENCH_RS_WORKER_THREADS (fils de travail du service Rust, défaut 1 ;
# la campagne v1 a été mesurée avec 2). Prérequis : `backend/dist` construit et
# `cargo build --release --locked --bins --examples` (`--examples` seul ne reconstruit pas
# le service).
#
#   bench.sh record                  passe 1 : legacy → proxy d'enregistrement → base
#   bench.sh parity [latence_ms]     rejeu strict, A puis B, comparaison des corps
#   bench.sh faults                  pannes amont imposées, A puis B, puis Rust arrêté
#   bench.sh live                    base réelle, séquentiel : A, B, retour arrière A
#   bench.sh load <A|B|C> <latence_ms> <répétition> [mesure_s]
#   bench.sh campaign                protocole complet (3 × A B C × L0/L20, dérive A/B)
#   bench.sh summary                 médianes et dispersions de results.jsonl
set -uo pipefail

BENCH=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CRATE=$(dirname "$BENCH")
REPO=$(cd "$CRATE/../.." && pwd)
REL=$CRATE/target/release
OUT=${BENCH_OUT:?BENCH_OUT absent}
ENV_FILE=${BENCH_ENV_FILE:-$REPO/backend/.env}
RECORD=127.0.0.1:3121
REPLAY=127.0.0.1:3122
RS=127.0.0.1:3110
PORT_A=3130
PORT_B=3131
# Ressources du protocole : cibles sur 2 CPU et 2 Go (conteneur PROD), rejeu et
# générateur sur d'autres CPU.
TARGET_CPUS=0,1
REPLAY_CPUS=4,5
LOADGEN_CPUS=6,7
CONCURRENCY=16
WARMUP_S=10
export BENCH_OUT ENV_FILE
mkdir -p "$OUT/pids"

die() { echo "bench: $*" >&2; exit 1; }
tools() { python3 -I "$BENCH/tools.py" "$@"; }

# start <nom> <commande…> : arrière-plan, journal <LOGDIR>/<nom>.log, PID du processus final.
start() {
  local name=$1; shift
  nohup bash -c 'echo $$ > "$0"; exec "$@"' "$OUT/pids/$name.pid" "$@" > "${LOGDIR:-$OUT}/$name.log" 2>&1 &
}
pid_of() { cat "$OUT/pids/$1.pid"; }
stop() {
  local pid
  pid=$(cat "$OUT/pids/$1.pid" 2>/dev/null) || return 0
  kill "$pid" 2>/dev/null
  for _ in $(seq 1 60); do
    kill -0 "$pid" 2>/dev/null || { rm -f "$OUT/pids/$1.pid"; return 0; }
    sleep 0.25
  done
  echo "bench: $1 ($pid) ne s'arrête pas, SIGKILL" >&2
  kill -9 "$pid" 2>/dev/null
  rm -f "$OUT/pids/$1.pid"
}
cleanup() { for f in "$OUT"/pids/*.pid; do [ -e "$f" ] && stop "$(basename "$f" .pid)"; done; }
trap cleanup EXIT
wait_http() {
  for _ in $(seq 1 240); do curl -s -o /dev/null "$1" && return 0; sleep 0.25; done
  die "indisponible : $1"
}
expect_flag() {
  local got
  got=$(curl -s "http://127.0.0.1:$1/__bench" | python3 -I -c 'import json,sys; print(str(json.load(sys.stdin)["vehicleModelsRsEnabled"]).lower())')
  [ "$got" = "$2" ] || die "flag attendu $2 sur :$1, lu $got"
}
replay_reset() { curl -s -X POST "http://$REPLAY/__reset"; }
replay_check() { curl -s "http://$REPLAY/__stats" | tools stats-ok || die "rejeu : clé absente ou en-tête différent"; }

# start_node <nom> <port> <amont|""> <true|false> : harnais ; amont vide = base du fichier d'environnement.
start_node() {
  start "$1" env NODE_ENV=production NODE_OPTIONS=--max-old-space-size=4096 BENCH_PORT="$2" \
    ${3:+"SUPABASE_URL=$3"} VEHICLE_MODELS_RS_ENABLED="$4" VEHICLE_MODELS_RS_URL="http://$RS" \
    node --env-file="$ENV_FILE" "$BENCH/harness.cjs"
}
# start_rust <amont|""> : service Rust, BENCH_RS_WORKER_THREADS fils de travail.
start_rust() {
  start rust env NODE_ENV=production ${1:+"SUPABASE_URL=$1"} \
    VEHICLE_MODELS_RS_WORKER_THREADS="${BENCH_RS_WORKER_THREADS:-1}" \
    python3 -I "$BENCH/tools.py" envexec "$ENV_FILE" "$REL/vehicle-models-rs"
}
start_replay() {
  start replay taskset -c "$REPLAY_CPUS" "$REL/examples/replay" replay "$REPLAY" "$OUT/recorded.jsonl" "$1"
  wait_http "http://$REPLAY/__stats"
}

# fetch_all <base> <fichier_chemins> <dossier> : un corps et un statut par cas, numérotés.
fetch_all() {
  local base=$1 paths=$2 dir=$3 n=0 line code
  rm -rf "$dir"; mkdir -p "$dir"; : > "$dir/index.txt"
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    n=$((n + 1))
    code=$(curl -s -o "$dir/$(printf %02d $n).body" -w '%{http_code}' --max-time 120 "$base$line")
    echo "$(printf %02d $n) $code $line" >> "$dir/index.txt"
  done < "$paths"
}
parity_paths() { cat "$BENCH/paths-load.txt" "$BENCH/paths-edge.txt" > "$OUT/paths-parity.txt"; }

cmd_record() {
  local file=$OUT/recorded.jsonl
  [ -e "$file" ] && die "$file existe déjà"
  parity_paths
  start record python3 -I "$BENCH/tools.py" envexec "$ENV_FILE" \
    sh -c 'exec "$0" record "$1" "$SUPABASE_URL" "$2"' "$REL/examples/replay" "$RECORD" "$file"
  wait_http "http://$RECORD/__stats"
  start_node node-a "$PORT_A" "http://$RECORD" false
  wait_http "http://127.0.0.1:$PORT_A/__bench"; expect_flag "$PORT_A" false
  fetch_all "http://127.0.0.1:$PORT_A" "$OUT/paths-parity.txt" "$OUT/record-A"
  echo "enregistrement : $(curl -s "http://$RECORD/__stats" | head -c 120)"
  stop node-a; stop record
  cut -d' ' -f2 "$OUT/record-A/index.txt" | sort | uniq -c
}

cmd_parity() {
  local lat=${1:-0}
  parity_paths; rm -f "$OUT/parity.ok"
  start_replay "$lat"
  start_node node-a "$PORT_A" "http://$REPLAY" false
  wait_http "http://127.0.0.1:$PORT_A/__bench"; expect_flag "$PORT_A" false
  fetch_all "http://127.0.0.1:$PORT_A" "$OUT/paths-parity.txt" "$OUT/parity-A"
  echo "A : $(curl -s "http://127.0.0.1:$PORT_A/__bench")"; replay_check
  stop node-a
  start_rust "http://$REPLAY"; wait_http "http://$RS/"
  replay_reset
  start_node node-b "$PORT_B" "http://$REPLAY" true
  wait_http "http://127.0.0.1:$PORT_B/__bench"; expect_flag "$PORT_B" true
  fetch_all "http://127.0.0.1:$PORT_B" "$OUT/paths-parity.txt" "$OUT/parity-B"
  echo "B : $(curl -s "http://127.0.0.1:$PORT_B/__bench")"; replay_check
  stop node-b; stop rust; stop replay
  echo "--- A rejeu / B rejeu"
  tools compare "$OUT/parity-A" "$OUT/parity-B" || die "parité A/B incomplète"
  if [ -d "$OUT/record-A" ]; then
    echo "--- A enregistrement / A rejeu"
    tools compare "$OUT/record-A" "$OUT/parity-A" || die "le rejeu ne reproduit pas l'enregistrement"
  fi
  touch "$OUT/parity.ok"
}

FAULT_PATH='/api/vehicles/brands/441/models?year=2008&page=0&limit=100'
FAULTS=(
  '503x1|{"status":503,"body":"{\"code\":\"PGRST002\",\"details\":null,\"hint\":null,\"message\":\"Could not query the database for the schema cache. Retrying.\"}","remaining":1}'
  '503xN|{"status":503,"body":"{\"code\":\"PGRST002\",\"details\":null,\"hint\":null,\"message\":\"Could not query the database for the schema cache. Retrying.\"}","remaining":-1}'
  '400xN|{"status":400,"body":"{\"code\":\"42703\",\"details\":null,\"hint\":null,\"message\":\"column auto_modele.x does not exist\"}","remaining":-1}'
  '500xN|{"status":500,"body":"{\"code\":\"XX000\",\"details\":null,\"hint\":null,\"message\":\"internal\"}","remaining":-1}'
  'objet200|{"status":200,"body":"{\"unexpected\":true}","remaining":-1}'
  'html502|{"status":502,"body":"<html>bad gateway</html>","remaining":-1}'
)
error_log_calls() {
  curl -s "http://127.0.0.1:$1/__bench" | python3 -I -c 'import json,sys; print(json.load(sys.stdin)["errorLogCalls"])'
}
# fault_round <A|B> <port> : chaque panne, statut, durée, appels à ErrorService.logError, empreinte du corps.
fault_round() {
  local f name spec before out
  for f in "${FAULTS[@]}"; do
    name=${f%%|*}; spec=${f#*|}
    replay_reset; curl -s -X POST -d "$spec" "http://$REPLAY/__fault"
    before=$(error_log_calls "$2")
    out=$(curl -s -o "$OUT/faults/$1-$name.body" -w '%{http_code} %{time_total}s' --max-time 120 "http://127.0.0.1:$2$FAULT_PATH")
    echo "$1 $name $out logError+$(( $(error_log_calls "$2") - before )) $(sed 's/"timestamp":"[^"]*"/"timestamp":"T"/' "$OUT/faults/$1-$name.body" | sha256sum | cut -c1-12)"
  done
  replay_reset
}
cmd_faults() {
  rm -rf "$OUT/faults"; mkdir -p "$OUT/faults"
  start_replay 0
  start_node node-a "$PORT_A" "http://$REPLAY" false
  wait_http "http://127.0.0.1:$PORT_A/__bench"; expect_flag "$PORT_A" false
  fault_round A "$PORT_A"; stop node-a
  start_rust "http://$REPLAY"; wait_http "http://$RS/"
  start_node node-b "$PORT_B" "http://$REPLAY" true
  wait_http "http://127.0.0.1:$PORT_B/__bench"; expect_flag "$PORT_B" true
  fault_round B "$PORT_B"
  # Rust arrêté, flag allumé : erreur explicite, aucun appel amont (pas de repli silencieux).
  stop rust; replay_reset
  local out
  out=$(curl -s -o "$OUT/faults/B-rust-arrete.body" -w '%{http_code} %{time_total}s' --max-time 120 "http://127.0.0.1:$PORT_B$FAULT_PATH")
  echo "B rust-arrêté $out amont=$(curl -s "http://$REPLAY/__stats" | head -c 40)"
  stop node-b; stop replay
}

cmd_live() {
  start_node node-a "$PORT_A" "" false
  wait_http "http://127.0.0.1:$PORT_A/__bench"; expect_flag "$PORT_A" false
  fetch_all "http://127.0.0.1:$PORT_A" "$BENCH/paths-live.txt" "$OUT/live-A"; stop node-a
  start_rust ""; wait_http "http://$RS/"
  start_node node-b "$PORT_B" "" true
  wait_http "http://127.0.0.1:$PORT_B/__bench"; expect_flag "$PORT_B" true
  fetch_all "http://127.0.0.1:$PORT_B" "$BENCH/paths-live.txt" "$OUT/live-B"; stop node-b; stop rust
  # Retour arrière : flag éteint, Rust arrêté, URL toujours configurée.
  start_node node-a "$PORT_A" "" false
  wait_http "http://127.0.0.1:$PORT_A/__bench"; expect_flag "$PORT_A" false
  fetch_all "http://127.0.0.1:$PORT_A" "$BENCH/paths-live.txt" "$OUT/live-A2"; stop node-a
  echo "--- A / B"; tools compare "$OUT/live-A" "$OUT/live-B"
  echo "--- A / A (retour arrière)"; tools compare "$OUT/live-A" "$OUT/live-A2"
}

# Cibles d'une passe de charge, lancées dans le scope systemd par cmd_load.
cmd_targets() {
  trap - EXIT
  case $1 in
    A) start_node node-a "$PORT_A" "http://$REPLAY" false ;;
    B) start_rust "http://$REPLAY"; start_node node-b "$PORT_B" "http://$REPLAY" true ;;
    C) start_rust "http://$REPLAY" ;;
  esac
  wait
}

cmd_load() {
  local cfg=$1 lat=$2 rep=$3 measure=${4:-60} base paths procs scope
  [ -e "$OUT/parity.ok" ] || die "parité non établie : lancer d'abord bench.sh parity"
  export LOGDIR=$OUT/runs/$cfg-L$lat-$rep
  rm -rf "$LOGDIR"; mkdir -p "$LOGDIR"
  start_replay "$lat"
  systemd-run --user --scope --quiet --unit="vmrs-bench-$cfg-L$lat-$rep-$$" \
    -p MemoryMax=2G -p MemorySwapMax=0 \
    taskset -c "$TARGET_CPUS" bash "$BENCH/bench.sh" _targets "$cfg" > "$LOGDIR/scope.log" 2>&1 &
  scope=$!
  case $cfg in
    A) wait_http "http://127.0.0.1:$PORT_A/__bench"; expect_flag "$PORT_A" false
       base=http://127.0.0.1:$PORT_A; paths=$BENCH/paths-load.txt; procs="node=$(pid_of node-a)" ;;
    B) wait_http "http://$RS/"; wait_http "http://127.0.0.1:$PORT_B/__bench"; expect_flag "$PORT_B" true
       base=http://127.0.0.1:$PORT_B; paths=$BENCH/paths-load.txt; procs="node=$(pid_of node-b) rust=$(pid_of rust)" ;;
    C) wait_http "http://$RS/"
       base=http://$RS; paths=$BENCH/paths-load-rs.txt; procs="rust=$(pid_of rust)" ;;
    *) die "configuration inconnue : $cfg" ;;
  esac
  sleep 5
  # shellcheck disable=SC2086
  tools sample "$LOGDIR/idle.json" 0 $procs
  replay_reset
  taskset -c "$LOADGEN_CPUS" "$REL/examples/loadgen" "$base" "$paths" "$CONCURRENCY" "$WARMUP_S" "$measure" > "$LOGDIR/load.json" &
  local loadgen=$!
  sleep "$WARMUP_S"
  # shellcheck disable=SC2086
  taskset -c "$LOADGEN_CPUS" python3 -I "$BENCH/tools.py" sample "$LOGDIR/run.json" "$measure" $procs
  wait "$loadgen" || die "loadgen en échec"
  curl -s "http://$REPLAY/__stats" > "$LOGDIR/replay.json"
  case $cfg in A) stop node-a ;; B) stop node-b; stop rust ;; C) stop rust ;; esac
  wait "$scope"
  stop replay
  tools run "$LOGDIR" "$cfg" "$lat" "$rep" | tee -a "$OUT/results.jsonl" | head -c 400; echo
}

cmd_campaign() {
  local lat rep cfg
  for lat in 0 20; do
    for rep in 1 2 3; do
      for cfg in A B C; do cmd_load "$cfg" "$lat" "$rep" 60; done
    done
  done
  cmd_load A 20 drift 300
  cmd_load B 20 drift 300
  tools summary "$OUT/results.jsonl"
}

case ${1:-} in
  record) cmd_record ;;
  parity) cmd_parity "${2:-0}" ;;
  faults) cmd_faults ;;
  live) cmd_live ;;
  load) [ $# -ge 4 ] || die "usage : bench.sh load <A|B|C> <latence_ms> <répétition> [mesure_s]"; cmd_load "$2" "$3" "$4" "${5:-60}" ;;
  campaign) cmd_campaign ;;
  summary) tools summary "$OUT/results.jsonl" ;;
  _targets) cmd_targets "$2" ;;
  *) sed -n '2,20p' "$0"; exit 2 ;;
esac
