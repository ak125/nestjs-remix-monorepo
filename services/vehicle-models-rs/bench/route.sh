#!/usr/bin/env bash
# Banc de la route complète GET /api/vehicles/brands/:brandId/models.
# A2 = backend Node complet (dist/main, frontend compris) ; R2 = route Rust
# complète (binaire vehicle-models-route) ; le même Caddy isolé est devant les
# deux et choisit, pour cette seule route, l'amont désigné par `select`.
# Tout est propre au banc : ports, Redis, secrets synthétiques, données rejouées.
# Ni le DEV partagé (:3000), ni le Redis partagé, ni la base ne sont modifiés ;
# seule `record` lit la base, en GET séquentiels sur une liste de tables.
#
# Variables : ROUTE_OUT (répertoire du banc, obligatoire, créé en mode 700) ;
# BENCH_ENV_FILE (fichier d'environnement contenant SUPABASE_URL et la clé
# service, lu par `record` seulement, défaut <dépôt>/backend/.env) ;
# ROUTE_DATA (enregistrements rejoués, séparés par « : ») ; CADDY_BIN ;
# ROUTE_CAMPAIGN (sortie des passes de charge, défaut ROUTE_OUT/campaign-v3).
# Prérequis : backend/dist et frontend/build construits ;
# `cargo build --release --locked --bins --examples`.
# Caddy et Redis tournent sur les CPU 2,3, le rejeu sur 4,5 (PROTOCOL-v3.md).
#
#   route.sh up [latence_ms]          Redis, rejeu, A2, R2, Caddy ; sélection node
#   route.sh select <node|rust>       bascule la route dans Caddy (retour arrière : select node)
#   route.sh reset <node|rust>        état initial d'une capture : Redis préparé, rejeu, A2, R2
#                                     redémarrés, sélection posée (Caddy doit tourner)
#   route.sh status                   processus du banc et amont servi par Caddy
#   route.sh down                     arrête les seuls processus du banc
#   route.sh start <redis|replay|a2|r2|caddy> [arg]
#   route.sh stop <nom>               un seul composant (a2 : arg = SUPABASE_URL)
#   route.sh record <sortie> <tables> <chemins…>
#                                     A2 → enregistreur → base, chemins appelés en série,
#                                     puis parcours ROUTE_JOURNEYS (« marque:année … »)
#   route.sh journey <base_url> <marque> <année|-> [desktop|mobile|diagnostic]
#                                     parcours du sélecteur dans Chrome (journey.mjs) ;
#                                     « diagnostic » : assistant sans année (année « - »)
#   route.sh load <a2|r2> <latence_ms> <répétition> [mesure_s]
#                                     passe de charge v3 via Caddy, pile neuve (banc arrêté) ;
#                                     répétition « long » : suivi jusqu'au plateau
#   route.sh campaign                 protocole v3 complet (bench/PROTOCOL-v3.md)
#   route.sh summary                  tableau de ROUTE_CAMPAIGN/results.jsonl
#   route.sh load4 <a2|a2c|r2> <latence_ms> <répétition> <mesure_s>
#                                     passe v4 (bench/PROTOCOL-v4.md) : débit fixe ROUTE_RATE,
#                                     sortie ROUTE_CAMPAIGN4 (défaut ROUTE_OUT/campaign-v4)
#   route.sh compress4 <passe>        compresse les journaux d'une passe v4 terminée
set -uo pipefail

BENCH=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CRATE=$(dirname "$BENCH")
REPO=$(cd "$CRATE/../.." && pwd)
REL=$CRATE/target/release
OUT=${ROUTE_OUT:?ROUTE_OUT absent}
ENV_FILE=${BENCH_ENV_FILE:-$REPO/backend/.env}
CADDY_BIN=${CADDY_BIN:-$HOME/.local/caddy-2.11.7/bin/caddy}
REDIS_PORT=3141
RECORD=127.0.0.1:3121
REPLAY=127.0.0.1:3122
A2_PORT=3140
R2_PORT=3150
CADDY_HTTP=3160
CADDY_HTTPS=3161
CADDY_ADMIN=127.0.0.1:3162
# Clés synthétiques : le rejeu n'en vérifie aucune, l'enregistreur injecte la sienne.
SYNTH_SERVICE_KEY=bench-synthetic-service-role
SYNTH_ANON_KEY=bench-synthetic-anon
# Sortie « sonde synthétique » exemptée : bloc de documentation RFC 5737.
PROBE_EGRESS=192.0.2.0/28
# Passes de charge v3 (PROTOCOL-v3.md) : cibles (Node, et Rust en r2) dans un même
# scope de 2 CPU et 2 Gio ; Caddy et Redis, mesurés aussi, sur leurs propres CPU.
TARGET_CPUS=0,1
PROXY_CPUS=2,3
LOADGEN_CPUS=6,7
CONCURRENCY=16
WARMUP_S=10
# IP clientes tournantes (bloc de documentation RFC 3849), sous les paliers du limiteur.
LOAD_IP_PREFIX=2001:db8:fff0::
LOAD_IPS=4096
LONG_MAX_S=3600
# Plateau du suivi long : vérifié chaque minute après 1800 s, pente sur 900 s, seuil 1 Mo/min.
LONG_PLATEAU=1800:900:1.0
CAMPAIGN=${ROUTE_CAMPAIGN:-$OUT/campaign-v3}
# Campagne v4 (PROTOCOL-v4.md) : boucle ouverte à débit fixe, plafond de requêtes en vol.
RATE=${ROUTE_RATE:-80}
MAX_INFLIGHT=64
CAMPAIGN4=${ROUTE_CAMPAIGN4:-$OUT/campaign-v4}
# Marge disque exigée avant une passe v4 : seuil d'arrêt (2 Gio) + volume d'une passe (1 Gio).
DISK_MIN4_B=$((3 * 1024 * 1024 * 1024))

mkdir -p -m 700 "$OUT"
mkdir -p "$OUT/pids" "$OUT/logs" "$OUT/sitemaps" "$OUT/crawl" "$OUT/redis" "$OUT/caddy"

die() { echo "route: $*" >&2; exit 1; }

# Heure de démarrage d'un processus (champ 22 de /proc/<pid>/stat, inchangée par exec) :
# avec le PID, elle identifie le processus lancé par start, même si le PID est réutilisé.
proc_start() { sed 's/.*) //' "/proc/$1/stat" 2>/dev/null | cut -d' ' -f20; }

# start <nom> <commande…> : arrière-plan, journal <LOGDIR>/<nom>.log (défaut logs/), PID du
# processus final et son heure de démarrage (pids/<nom>.start, écrite avant pids/<nom>.pid).
# Si la FIFO <LOGDIR>/<nom>.fifo existe (v4, logpipe), la sortie y va à la place du journal.
start() {
  local name=$1 log; shift
  [ -e "$OUT/pids/$name.pid" ] && kill -0 "$(cat "$OUT/pids/$name.pid")" 2>/dev/null \
    && die "$name tourne déjà"
  log=${LOGDIR:-$OUT/logs}/$name.log
  [ -p "${LOGDIR:-$OUT/logs}/$name.fifo" ] && log=${LOGDIR:-$OUT/logs}/$name.fifo
  nohup bash -c 'sed "s/.*) //" /proc/$$/stat | cut -d" " -f20 > "${0%.pid}.start"; echo $$ > "$0"; exec "$@"' \
    "$OUT/pids/$name.pid" "$@" > "$log" 2>&1 &
  sleep 0.2
}
# logpipe <nom> <fichier> : FIFO <LOGDIR>/<nom>.fifo et son lecteur, lancé ici (hors du scope des
# cibles, CPU 4,5) : les pages du fichier écrit sont imputées au lecteur, pas aux cibles.
logpipe() {
  mkfifo -m 600 "$LOGDIR/$1.fifo" || die "FIFO $1 impossible"
  start "pipe-$1" taskset -c 4,5 sh -c 'exec cat "$0" > "$1"' "$LOGDIR/$1.fifo" "$LOGDIR/$2"
}
# stop <nom> : n'envoie un signal qu'au processus lancé par start (PID et heure de démarrage
# concordants) ; sans pids/<nom>.start ou en cas de discordance, refuse sans rien tuer.
stop() {
  local pid want
  pid=$(cat "$OUT/pids/$1.pid" 2>/dev/null) || return 0
  want=$(cat "$OUT/pids/$1.start" 2>/dev/null) \
    || die "$1 ($pid) : pids/$1.start absent, identité invérifiable, arrêt refusé"
  case "$(proc_start "$pid")" in
    "") rm -f "$OUT/pids/$1.pid" "$OUT/pids/$1.start"; return 0 ;;
    "$want") ;;
    *) die "$1 : le PID $pid désigne un autre processus que celui lancé par le banc, arrêt refusé" ;;
  esac
  kill "$pid" 2>/dev/null
  for _ in $(seq 1 80); do
    [ "$(proc_start "$pid")" = "$want" ] || { rm -f "$OUT/pids/$1.pid" "$OUT/pids/$1.start"; return 0; }
    sleep 0.25
  done
  echo "route: $1 ($pid) ne s'arrête pas, SIGKILL" >&2
  [ "$(proc_start "$pid")" = "$want" ] && kill -9 "$pid" 2>/dev/null
  rm -f "$OUT/pids/$1.pid" "$OUT/pids/$1.start"
}
# alive <nom> : processus lancé par start toujours en vie (PID et heure de démarrage).
alive() {
  local pid
  pid=$(cat "$OUT/pids/$1.pid" 2>/dev/null) || return 1
  [ -n "$(proc_start "$pid")" ] && [ "$(proc_start "$pid")" = "$(cat "$OUT/pids/$1.start" 2>/dev/null)" ]
}
wait_http() {
  for _ in $(seq 1 240); do curl -sk -o /dev/null "$1" && return 0; sleep 0.25; done
  die "indisponible : $1"
}

# Secrets synthétiques du banc (fichier 600), partagés par A2, R2 et contract.py.
secrets() {
  local f=$OUT/secrets.env name
  ( umask 077; touch "$f" )
  for name in SESSION_SECRET JWT_SECRET SEO_CP_SYNTHETIC_PROBE_SECRET; do
    grep -q "^$name=" "$f" ||
      printf '%s=%s\n' "$name" "$(head -c 36 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=')" >> "$f"
  done
  set -a; . "$f"; set +a
}

start_redis() {
  start redis taskset -c "$PROXY_CPUS" redis-server --bind 127.0.0.1 --port "$REDIS_PORT" --save '' \
    --appendonly no --dir "$OUT/redis"
  for _ in $(seq 1 40); do redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1 && return 0; sleep 0.25; done
  die "Redis du banc indisponible"
}

# start_replay [latence_ms] : enregistrements de ROUTE_DATA.
start_replay() {
  local files
  IFS=: read -ra files <<< "${ROUTE_DATA:?ROUTE_DATA absent}"
  start replay taskset -c 4,5 "$REL/examples/replay" replay "$REPLAY" "${files[0]}" "${1:-0}" "${files[@]:1}"
  wait_http "http://$REPLAY/__stats"
}

# start_a2 <SUPABASE_URL> : backend Node complet, environnement vide hormis la liste.
start_a2() {
  secrets
  # v4 : sonde mémoire dans le processus testé lui-même (bench/memprobe.cjs), sortie MEMPROBE_OUT.
  # Tas : plafond par défaut de V8, comme l'image ; A2_HEAP_MB le fixe (passe a2 diag, amendement 1).
  local node_options=${A2_HEAP_MB:+--max-old-space-size=$A2_HEAP_MB}
  [ -n "${MEMPROBE_OUT:-}" ] && node_options="${node_options:+$node_options }--require $BENCH/memprobe.cjs"
  local env=(
    HOME="$HOME" PATH="$PATH" TZ=Europe/Paris LANG=C.UTF-8
    NODE_ENV=production READ_ONLY=true PORT="$A2_PORT"
    NODE_OPTIONS="$node_options" ${MEMPROBE_OUT:+MEMPROBE_OUT="$MEMPROBE_OUT"}
    SUPABASE_URL="$1"
    SUPABASE_SERVICE_ROLE_KEY="$SYNTH_SERVICE_KEY" SUPABASE_ANON_KEY="$SYNTH_ANON_KEY"
    REDIS_URL="redis://127.0.0.1:$REDIS_PORT" REDIS_HOST=127.0.0.1 REDIS_PORT="$REDIS_PORT"
    SESSION_SECRET="$SESSION_SECRET" JWT_SECRET="$JWT_SECRET"
    SEO_CP_SYNTHETIC_PROBE_ENABLED=true SEO_CP_SYNTHETIC_PROBE_SECRET="$SEO_CP_SYNTHETIC_PROBE_SECRET"
    SEO_CP_SYNTHETIC_PROBE_EGRESS_IPS="$PROBE_EGRESS"
    API_BASE_URL="http://127.0.0.1:$A2_PORT" BACKEND_URL="http://127.0.0.1:$A2_PORT"
    INTERNAL_API_BASE_URL="http://127.0.0.1:$A2_PORT" API_URL="http://127.0.0.1:$A2_PORT"
    VITE_API_URL="http://127.0.0.1:$A2_PORT"
    # Services externes fermés (port 9) et tâches de fond coupées.
    RAG_SERVICE_URL=http://127.0.0.1:9 MEILISEARCH_HOST=http://127.0.0.1:9
    MEILISEARCH_API_KEY=bench-synthetic RAG_API_KEY=bench-synthetic
    SEO_CP_SYNTHETIC_ENABLED=false SEO_SITEMAP_CRON_ENABLED=false SEO_CP_CF_ANALYTICS_ENABLED=false
    SEO_CP_RUNTIME_LOGS_ENABLED=false SEO_MONITORING_ENABLED=false SUPPLIER_TRUTH_SYNC_ENABLED=false
    ABANDONED_CART_EMAIL_ENABLED=false
    SITEMAP_OUTPUT_DIR="$OUT/sitemaps" CRAWL_HUBS_DIR="$OUT/crawl"
  )
  (cd "$REPO/backend" && start a2 env -i "${env[@]}" node dist/main)
  wait_http "http://127.0.0.1:$A2_PORT/health"
}

# start_r2 : route Rust complète, mêmes ressources que A2.
start_r2() {
  secrets
  local env=(
    HOME="$HOME" PATH="$PATH" TZ=Europe/Paris LANG=C.UTF-8
    NODE_ENV=production
    ROUTE_LISTEN="127.0.0.1:$R2_PORT"
    SUPABASE_URL="http://$REPLAY" SUPABASE_SERVICE_ROLE_KEY="$SYNTH_SERVICE_KEY"
    REDIS_URL="redis://127.0.0.1:$REDIS_PORT"
    SESSION_SECRET="$SESSION_SECRET"
    SEO_CP_SYNTHETIC_PROBE_ENABLED=true SEO_CP_SYNTHETIC_PROBE_SECRET="$SEO_CP_SYNTHETIC_PROBE_SECRET"
    SEO_CP_SYNTHETIC_PROBE_EGRESS_IPS="$PROBE_EGRESS"
    VEHICLE_MODELS_RS_WORKER_THREADS="${R2_WORKER_THREADS:-1}"
  )
  start r2 env -i "${env[@]}" "$REL/vehicle-models-route"
  wait_http "http://127.0.0.1:$R2_PORT/health"
}

# write_selection <node|rust> : bloc reverse_proxy de la route.
write_selection() {
  local port
  case "$1" in node) port=$A2_PORT ;; rust) port=$R2_PORT ;; *) die "sélection inconnue : $1" ;; esac
  cat > "$OUT/caddy/selection.caddy.tmp" <<EOF
# sélection : $1 (écrite par route.sh $(date -Is))
reverse_proxy 127.0.0.1:$port {
	import proxy_headers
}
EOF
  mv "$OUT/caddy/selection.caddy.tmp" "$OUT/caddy/selection.caddy"
}

caddy_vars() {
  CADDY_VARS=(ROUTE_OUT="${CADDY_OUT:-$OUT}" ROUTE_CADDY_ADMIN="$CADDY_ADMIN" ROUTE_SELECTION="$OUT/caddy/selection.caddy"
    ROUTE_NODE="127.0.0.1:$A2_PORT" ROUTE_CADDY_HTTP="$CADDY_HTTP" ROUTE_CADDY_HTTPS="$CADDY_HTTPS"
    XDG_DATA_HOME="$OUT/caddy/data" XDG_CONFIG_HOME="$OUT/caddy/config")
}

start_caddy() {
  write_selection "$1"; caddy_vars
  start caddy taskset -c "$PROXY_CPUS" env "${CADDY_VARS[@]}" "$CADDY_BIN" run --config "$BENCH/Caddyfile.route" --adapter caddyfile
  wait_http "http://$CADDY_ADMIN/config/"
}

# Amont de la route lu dans la configuration active de Caddy (pas dans le fichier).
served_upstream() {
  curl -s "http://$CADDY_ADMIN/config/apps/http/servers" | python3 -I -c '
import json, sys
dials = set()
def walk(node, in_route):
    if isinstance(node, dict):
        here = in_route or any(
            isinstance(m, dict) and "path_regexp" in m and m["path_regexp"].get("name") == "vehicle_models"
            for m in node.get("match", []) or [])
        if here and node.get("handler") == "reverse_proxy":
            for u in node.get("upstreams", []):
                dials.add(u.get("dial"))
        for v in node.values():
            walk(v, here)
    elif isinstance(node, list):
        for v in node:
            walk(v, in_route)
walk(json.load(sys.stdin), False)
print(" ".join(sorted(d for d in dials if d)) or "aucun")'
}

expect_selection() {
  local want got
  case "$1" in node) want=127.0.0.1:$A2_PORT ;; rust) want=127.0.0.1:$R2_PORT ;; esac
  got=$(served_upstream)
  [ "$got" = "$want" ] || die "Caddy sert $got pour la route, attendu $want ($1)"
  echo "route: Caddy sert la route via $got ($1)"
}

select_backend() {
  write_selection "$1"; caddy_vars
  env "${CADDY_VARS[@]}" "$CADDY_BIN" reload --config "$BENCH/Caddyfile.route" --adapter caddyfile \
    --address "$CADDY_ADMIN" || die "rechargement Caddy refusé ; sélection précédente conservée"
  expect_selection "$1"
}

# journey <base_url> <marque> <année> <forme> : sortie dans journeys/, un fichier par passage.
journey() {
  mkdir -p "$OUT/journeys"
  local f i code
  # Contrôle de santé actif de Caddy (30 s) : après un redémarrage d'A2, Caddy répond
  # lui-même 500 aux pages tant qu'il n'a pas revu /health. Attente explicite, 45 s au plus.
  for i in $(seq 45); do
    code=$(curl -ks -o /dev/null -w '%{http_code}' "$1/health")
    [ "$code" = 200 ] && break
    sleep 1
  done
  [ "$code" = 200 ] || die "parcours : $1/health répond $code après 45 s"
  echo "route: $1/health = 200 après $i s" >&2
  f="$OUT/journeys/$(date +%Y%m%dT%H%M%S%N)-$2-$3-$4.json"
  (cd "$REPO" && node "$BENCH/journey.mjs" "$1" "$f" "$2" "$3" "$4") || echo "route: parcours en échec, voir $f" >&2
}

tools() { python3 -I "$BENCH/tools.py" "$@"; }

# Cibles d'une passe de charge, lancées dans le scope systemd par cmd_load.
# v4 (HOLD_FILE) : le shell reste dans le scope après la fin ou la mort des cibles, jusqu'à la
# libération par cmd_load4 ; le cgroup et ses compteurs restent lisibles pour les relevés de fin.
# Le wait ne retient pas ce shell : start lance a2 dans une sous-coquille, dont il n'est pas le parent.
cmd_targets() {
  [ -n "${HOLD_FILE:-}" ] && echo $$ > "$LOGDIR/holder.pid"
  start_a2 "http://$REPLAY"
  [ "$1" = r2 ] && start_r2
  wait
  if [ -n "${HOLD_FILE:-}" ]; then
    while [ ! -e "$HOLD_FILE" ]; do sleep 1; done
  fi
  return 0
}

# cmd_load <a2|r2> <latence_ms> <répétition> [mesure_s] : pile neuve, charge via Caddy (HTTP),
# relevés à 1 Hz des cibles, de Caddy et de Redis, puis destination lue dans le journal Caddy.
cmd_load() {
  local cfg=$1 lat=$2 rep=$3 measure=${4:-60} sel upstream dir procs scope loadgen n plateau=
  case $cfg in a2) sel=node; upstream=127.0.0.1:$A2_PORT ;; r2) sel=rust; upstream=127.0.0.1:$R2_PORT ;;
    *) die "configuration inconnue : $cfg" ;; esac
  for n in caddy r2 a2 replay record redis; do alive "$n" && die "$n tourne : route.sh down avant une passe de charge"; done
  dir=$CAMPAIGN/runs/$cfg-L$lat-$rep
  [ -e "$dir" ] && die "$dir existe déjà"
  [ "$rep" = long ] && plateau=$LONG_PLATEAU
  mkdir -p "$dir"; export LOGDIR=$dir
  # Sortie anticipée (die) : la pile de la passe est arrêtée, processus du banc seulement.
  trap 'for n in caddy r2 a2 replay redis; do stop "$n"; done' EXIT
  trap 'exit 143' TERM INT HUP
  start_redis
  python3 -I "$BENCH/contract.py" prepare > "$dir/prepare.log" || die "préparation du Redis du banc refusée"
  start_replay "$lat"
  systemd-run --user --scope --quiet --unit="vmrs-route-$cfg-L$lat-$rep-$$" \
    -p MemoryMax=2G -p MemorySwapMax=0 \
    taskset -c "$TARGET_CPUS" bash "$BENCH/route.sh" _targets "$cfg" > "$dir/scope.log" 2>&1 &
  scope=$!
  wait_http "http://127.0.0.1:$A2_PORT/health"
  procs="node=$(cat "$OUT/pids/a2.pid")"
  if [ "$cfg" = r2 ]; then
    wait_http "http://127.0.0.1:$R2_PORT/health"
    procs="$procs rust=$(cat "$OUT/pids/r2.pid")"
  fi
  CADDY_OUT=$dir start_caddy "$sel"
  expect_selection "$sel" > "$dir/selection.txt"
  procs="$procs caddy=$(cat "$OUT/pids/caddy.pid") redis=$(cat "$OUT/pids/redis.pid")"
  echo "$procs" > "$dir/procs.txt"
  sleep 5
  # shellcheck disable=SC2086
  SAMPLE_CPUS=$TARGET_CPUS tools sample "$dir/idle.json" 0 $procs
  curl -s -X POST "http://$REPLAY/__reset" >/dev/null
  LOADGEN_HEADERS=$BENCH/load-headers.txt LOADGEN_IP_PREFIX=$LOAD_IP_PREFIX LOADGEN_IP_COUNT=$LOAD_IPS \
    LOADGEN_PROGRESS=$dir/progress.json taskset -c "$LOADGEN_CPUS" "$REL/examples/loadgen" \
    "http://localhost:$CADDY_HTTP" "$BENCH/paths-load.txt" "$CONCURRENCY" "$WARMUP_S" "$measure" > "$dir/load.json" &
  loadgen=$!
  sleep "$WARMUP_S"
  # shellcheck disable=SC2086
  SAMPLE_CPUS=$TARGET_CPUS SAMPLE_WATCH=$dir/progress.json SAMPLE_PLATEAU=$plateau \
    taskset -c "$LOADGEN_CPUS" python3 -I "$BENCH/tools.py" sample "$dir/run.json" "$measure" $procs
  wait "$loadgen" || die "loadgen en échec"
  curl -s "http://$REPLAY/__stats" > "$dir/replay.json"
  { redis-cli -p "$REDIS_PORT" dbsize; redis-cli -p "$REDIS_PORT" info memory; } > "$dir/redis-end.txt"
  for n in caddy r2 a2; do stop "$n"; done
  wait "$scope"
  for n in replay redis; do stop "$n"; done
  unset LOGDIR
  tools upstreams "$dir" "$upstream" > "$dir/destination.json"
  tools run "$dir" "$cfg" "$lat" "$rep" > "$dir/result.json" || die "résultat illisible : $dir"
  cat "$dir/result.json" >> "$CAMPAIGN/results.jsonl"
  trap - EXIT TERM INT HUP
  tools brief "$dir/result.json" "$cfg-L$lat-$rep" || die "destination erronée dans $dir : campagne interrompue"
}

# versions4 <config> : versions et empreintes d'une passe v4, relevées à son lancement.
versions4() {
  local data tdir
  IFS=: read -ra data <<<"$ROUTE_DATA"
  tdir=$REPO/node_modules/@nestjs/throttler
  echo "config $1"
  echo "date $(date -Iseconds)"
  echo "commit $(git -C "$REPO" rev-parse HEAD)"
  echo "worktree_status $(git -C "$REPO" status --porcelain --untracked-files=no | wc -l) fichier(s) suivi(s) modifié(s)"
  echo "node $(node --version)"
  if [ -n "${A2_HEAP_MB:-}" ]; then echo "node_heap --max-old-space-size=$A2_HEAP_MB"
  else echo "node_heap plafond par défaut de V8"; fi
  echo "caddy $("$CADDY_BIN" version)"
  echo "redis $(redis-server --version)"
  echo "machine $(uname -r) ; $(nproc) CPU ; $(lscpu | sed -n 's/^Model name: *//p')"
  echo "a2_dist $(cd "$REPO/backend/dist" && find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)"
  echo "throttler $(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$tdir/package.json") $(cd "$tdir" && find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)"
  echo "rate $RATE max_inflight $MAX_INFLIGHT warmup $WARMUP_S ips $LOAD_IPS"
  echo "disk_free_b $(df --output=avail -B1 "$OUT" | tail -1 | tr -d ' ')"
  echo "loadavg $(cut -d' ' -f1-3 /proc/loadavg)"
  sha256sum "$REL/vehicle-models-route" "$REL/examples/loadgen" "$REL/examples/replay" \
    "$BENCH/PROTOCOL-v4.md" "$BENCH/paths-load.txt" "$BENCH/load-headers.txt" "$BENCH/Caddyfile.route" \
    "$BENCH/route.sh" "$BENCH/tools.py" "$BENCH/contract.py" "$BENCH/memprobe.cjs" "${data[@]}" 2>&1
}

# cmd_load4 <a2|a2c|r2> <latence_ms> <répétition> <mesure_s> : passe v4 (PROTOCOL-v4.md). a2 = tas
# de 4096 Mo comme en v3 (passe diag) ; a2c et r2 = Node lancé comme l'image (amendement 1), limiteur
# corrigé si le diagnostic l'établit ; tas et limiteur relevés dans versions.txt.
cmd_load4() {
  local cfg=$1 lat=$2 rep=$3 measure=$4 sel upstream dir procs scope loadgen n targets free
  case $cfg in
    a2) sel=node; upstream=127.0.0.1:$A2_PORT; targets=a2; export A2_HEAP_MB=4096 ;;
    a2c) sel=node; upstream=127.0.0.1:$A2_PORT; targets=a2; unset A2_HEAP_MB ;;
    r2) sel=rust; upstream=127.0.0.1:$R2_PORT; targets=r2; unset A2_HEAP_MB ;;
    *) die "configuration inconnue : $cfg" ;;
  esac
  for n in caddy r2 a2 replay record redis pipe-a2 pipe-r2 pipe-memprobe; do
    alive "$n" && die "$n tourne : route.sh down avant une passe de charge"
  done
  : "${ROUTE_DATA:?ROUTE_DATA absent}"
  # Sources de la passe = le commit relevé dans versions.txt : aucun fichier suivi modifié.
  [ -z "$(git -C "$REPO" status --porcelain --untracked-files=no)" ] \
    || die "fichiers suivis modifiés : commit requis avant une passe v4"
  dir=$CAMPAIGN4/runs/$cfg-L$lat-$rep
  [ -e "$dir" ] && die "$dir existe déjà"
  mkdir -p "$CAMPAIGN4/runs"
  free=$(df --output=avail -B1 "$CAMPAIGN4" | tail -1 | tr -d ' ')
  [ "$free" -ge "$DISK_MIN4_B" ] || die "disque libre $free o < $DISK_MIN4_B o : passe refusée"
  mkdir -p "$dir"
  export LOGDIR=$dir HOLD_FILE=$dir/release MEMPROBE_OUT=$dir/memprobe.fifo
  # Sortie anticipée : scope libéré, pile de la passe arrêtée (processus du banc seulement).
  trap 'touch "$HOLD_FILE"; for n in caddy r2 a2 replay redis pipe-a2 pipe-r2 pipe-memprobe; do stop "$n"; done' EXIT
  trap 'exit 143' TERM INT HUP
  versions4 "$cfg" > "$dir/versions.txt"
  start_redis
  python3 -I "$BENCH/contract.py" prepare > "$dir/prepare.log" || die "préparation du Redis du banc refusée"
  start_replay "$lat"
  logpipe a2 a2.log
  logpipe memprobe memprobe.jsonl
  [ "$targets" = r2 ] && logpipe r2 r2.log
  systemd-run --user --scope --quiet --unit="vmrs-route4-$cfg-L$lat-$rep-$$" \
    -p MemoryMax=2G -p MemorySwapMax=0 -p OOMPolicy=continue \
    taskset -c "$TARGET_CPUS" bash "$BENCH/route.sh" _targets "$targets" > "$dir/scope.log" 2>&1 &
  scope=$!
  wait_http "http://127.0.0.1:$A2_PORT/health"
  procs="node=$(cat "$OUT/pids/a2.pid")"
  if [ "$targets" = r2 ]; then
    wait_http "http://127.0.0.1:$R2_PORT/health"
    procs="$procs rust=$(cat "$OUT/pids/r2.pid")"
  fi
  CADDY_OUT=$dir start_caddy "$sel"
  expect_selection "$sel" > "$dir/selection.txt"
  procs="$procs caddy=$(cat "$OUT/pids/caddy.pid") redis=$(cat "$OUT/pids/redis.pid")"
  echo "$procs" > "$dir/procs.txt"
  sleep 5
  tools cgsnap "$dir/cgroup-pre.json" "$(cat "$dir/holder.pid")"
  # shellcheck disable=SC2086
  SAMPLE_CPUS=$TARGET_CPUS tools sample "$dir/idle.json" 0 $procs
  curl -s -X POST "http://$REPLAY/__reset" >/dev/null
  LOADGEN_RATE=$RATE LOADGEN_SERIES=$dir/loadgen-series.jsonl \
    LOADGEN_HEADERS=$BENCH/load-headers.txt LOADGEN_IP_PREFIX=$LOAD_IP_PREFIX LOADGEN_IP_COUNT=$LOAD_IPS \
    LOADGEN_PROGRESS=$dir/progress.json taskset -c "$LOADGEN_CPUS" "$REL/examples/loadgen" \
    "http://localhost:$CADDY_HTTP" "$BENCH/paths-load.txt" "$MAX_INFLIGHT" "$WARMUP_S" "$measure" > "$dir/load.json" &
  loadgen=$!
  sleep "$WARMUP_S"
  # shellcheck disable=SC2086
  SAMPLE_CPUS=$TARGET_CPUS SAMPLE_WATCH=$dir/progress.json SAMPLE_LOAD_STOP=0 \
    SAMPLE_SERIES=$dir/sample-series.jsonl \
    taskset -c "$LOADGEN_CPUS" python3 -I "$BENCH/tools.py" sample "$dir/run.json" "$measure" $procs
  wait "$loadgen" || echo "route: loadgen en échec (code $?)" >&2
  curl -s "http://$REPLAY/__stats" > "$dir/replay.json"
  { redis-cli -p "$REDIS_PORT" dbsize; redis-cli -p "$REDIS_PORT" info memory; } > "$dir/redis-end.txt"
  tools cgsnap "$dir/cgroup-post.json" "$(cat "$dir/holder.pid")"
  for n in caddy r2 a2; do stop "$n"; done
  sleep 1
  tools cgsnap "$dir/cgroup-end.json" "$(cat "$dir/holder.pid")"
  touch "$HOLD_FILE"
  wait "$scope"
  for n in replay redis; do stop "$n"; done
  # Lecteurs des FIFO : fin de fichier quand les cibles ont fermé leur sortie.
  for n in pipe-a2 pipe-r2 pipe-memprobe; do
    for _ in $(seq 20); do alive "$n" || break; sleep 0.25; done
    stop "$n"
  done
  unset LOGDIR HOLD_FILE MEMPROBE_OUT
  tools upstreams "$dir" "$upstream" > "$dir/destination.json"
  tools run4 "$dir" "$cfg" "$lat" "$rep" > "$dir/result.json" || die "résultat illisible : $dir"
  cat "$dir/result.json" >> "$CAMPAIGN4/results.jsonl"
  trap - EXIT TERM INT HUP
  tools brief4 "$dir/result.json" "$cfg-L$lat-$rep"
}

# load_checked : une passe dont la CPU des voisins sur les CPU cibles dépasse le seuil est rejouée une fois.
load_checked() {
  cmd_load "$@"
  tools foreign-ok "$CAMPAIGN/runs/$1-L$2-$3/result.json" || cmd_load "$1" "$2" "$3b" "${4:-60}"
}

# Versions et empreintes relevées avant la première passe (PROTOCOL-v3.md, « Versions »).
campaign_versions() {
  local data
  [ -z "$(git -C "$CRATE" status --porcelain -- .)" ] || die "$CRATE a des changements non commités : campagne refusée"
  IFS=: read -ra data <<<"$ROUTE_DATA"
  {
    echo "date $(date -Iseconds)"
    echo "commit $(git -C "$REPO" rev-parse HEAD)"
    echo "node $(node --version)"
    echo "caddy $("$CADDY_BIN" version)"
    echo "redis $(redis-server --version)"
    echo "machine $(uname -r) ; $(nproc) CPU ; $(lscpu | sed -n 's/^Model name: *//p')"
    echo "a2_dist $(cd "$REPO/backend/dist" && find . -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)"
    sha256sum "$REL/vehicle-models-route" "$REL/examples/loadgen" "$REL/examples/replay" \
      "$BENCH/PROTOCOL-v3.md" "$BENCH/paths-load.txt" "$BENCH/load-headers.txt" "$BENCH/Caddyfile.route" \
      "$BENCH/route.sh" "$BENCH/tools.py" "$BENCH/contract.py" "${data[@]}"
  } > "$CAMPAIGN/versions.txt"
}

cmd_campaign() {
  local lat rep cfg
  mkdir -p "$CAMPAIGN"
  [ -e "$CAMPAIGN/results.jsonl" ] && die "$CAMPAIGN/results.jsonl existe déjà"
  campaign_versions
  for lat in 0 20; do
    for rep in 1 2 3; do
      for cfg in a2 r2; do load_checked "$cfg" "$lat" "$rep" 60; done
    done
  done
  cmd_load a2 20 long "$LONG_MAX_S"
  cmd_load r2 20 long "$LONG_MAX_S"
  tools summary "$CAMPAIGN/results.jsonl"
}

cmd=${1:-}; shift || true
case "$cmd" in
  up)
    start_redis
    start_replay "${1:-0}"
    start_a2 "http://$REPLAY"
    start_r2
    start_caddy node
    expect_selection node
    ;;
  select)
    select_backend "${1:?node|rust}"
    ;;
  reset)
    # Même état initial pour chaque capture : Redis du banc vidé puis configuration
    # BotGuard du contrat (lue au démarrage), rejeu, A2 et R2 redémarrés, sélection posée.
    for n in r2 a2 replay; do stop "$n"; done
    python3 -I "$BENCH/contract.py" prepare || die "préparation du Redis du banc refusée"
    start_replay 0
    start_a2 "http://$REPLAY"
    start_r2
    select_backend "${1:?node|rust}"
    ;;
  status)
    for f in "$OUT"/pids/*.pid; do
      [ -e "$f" ] || continue
      n=$(basename "$f" .pid); p=$(cat "$f"); t=$(proc_start "$p")
      if [ -z "$t" ]; then echo "$n $p arrêté"
      elif [ ! -e "$OUT/pids/$n.start" ]; then echo "$n $p actif, identité invérifiable (pas de pids/$n.start)"
      elif [ "$t" = "$(cat "$OUT/pids/$n.start")" ]; then echo "$n $p actif"
      else echo "$n $p : PID réutilisé par un autre processus"; fi
    done
    [ -e "$OUT/pids/caddy.pid" ] && echo "route servie via : $(served_upstream)"
    ;;
  down)
    for n in caddy r2 a2 replay record redis; do stop "$n"; done
    ;;
  start)
    case "${1:?composant}" in
      redis) start_redis ;;
      replay) start_replay "${2:-0}" ;;
      a2) start_a2 "${2:-http://$REPLAY}" ;;
      r2) start_r2 ;;
      caddy) start_caddy "${2:-node}"; expect_selection "${2:-node}" ;;
      *) die "composant inconnu : $1" ;;
    esac
    ;;
  stop)
    stop "${1:?nom}"
    ;;
  record)
    out=${1:?fichier de sortie}; tables=${2:?tables}; shift 2
    [ -e "$out" ] && die "$out existe déjà"
    [ -r "$ENV_FILE" ] || die "environnement illisible : $ENV_FILE"
    trap 'for n in a2 record redis; do stop "$n"; done' EXIT
    start_redis
    # La clé service est chargée par envexec dans l'environnement de l'enregistreur, jamais affichée.
    start record python3 -I "$BENCH/tools.py" envexec "$ENV_FILE" \
      env RECORD_TABLES="$tables" sh -c 'exec "$0" record "$1" "$SUPABASE_URL" "$2"' \
      "$REL/examples/replay" "$RECORD" "$out"
    wait_http "http://$RECORD/__stats"
    start_a2 "http://$RECORD"
    sleep 5
    curl -s -X POST "http://$RECORD/__reset" >/dev/null
    for path in "$@"; do
      code=$(curl -gs --path-as-is -o /dev/null -w '%{http_code}' "http://127.0.0.1:$A2_PORT$path")
      echo "$code $path"
    done
    for j in ${ROUTE_JOURNEYS:-}; do
      journey "http://127.0.0.1:$A2_PORT" "${j%%:*}" "${j##*:}" desktop
    done
    curl -s "http://$RECORD/__stats"; echo
    ;;
  journey)
    journey "${1:?base_url}" "${2:?marque}" "${3:?année}" "${4:-desktop}"
    ;;
  load)
    [ $# -ge 3 ] || die "usage : route.sh load <a2|r2> <latence_ms> <répétition> [mesure_s]"
    mkdir -p "$CAMPAIGN"
    cmd_load "$1" "$2" "$3" "${4:-60}"
    ;;
  campaign)
    cmd_campaign
    ;;
  summary)
    tools summary "$CAMPAIGN/results.jsonl"
    ;;
  load4)
    [ $# -eq 4 ] || die "usage : route.sh load4 <a2|a2c|r2> <latence_ms> <répétition> <mesure_s>"
    cmd_load4 "$1" "$2" "$3" "$4"
    ;;
  compress4)
    d=${1:?passe}
    [ -s "$d/result.json" ] || die "$d : passe non terminée (result.json absent)"
    for f in "$d"/a2.log "$d"/r2.log "$d"/memprobe.jsonl "$d"/caddy-requests*.log; do
      [ -f "$f" ] && nice -n 10 taskset -c 4-7 gzip -9 "$f"
    done
    ;;
  _targets)
    cmd_targets "$1"
    ;;
  *)
    sed -n '2,37p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
