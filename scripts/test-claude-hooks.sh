#!/usr/bin/env bash
#
# test-claude-hooks.sh — tests bash plain pour les nouveaux hooks Claude.
#
# Pattern repo `scripts/test-<thing>.sh` (cohérent avec test-internal-links.sh,
# test-payment-tunnel.sh, etc.). Pas de bats — non installé.
#
# Couvre 3 cas par hook neuf :
#   1. Nominal (entrée attendue → comportement attendu)
#   2. Fichier inexistant / input vide
#   3. CLAUDE_HOOKS_DISABLE=1 (rollback rapide)

set -u

PASS=0
FAIL=0
FAILED_TESTS=()

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo /opt/automecanik/app)"
cd "$REPO_ROOT" || exit 1

assert_exit() {
  local description="$1"
  local expected_exit="$2"
  local actual_exit="$3"
  if [ "$expected_exit" = "$actual_exit" ]; then
    PASS=$((PASS+1))
    echo "  PASS: $description"
  else
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$description (expected exit=$expected_exit, got $actual_exit)")
    echo "  FAIL: $description (expected exit=$expected_exit, got $actual_exit)"
  fi
}

assert_contains() {
  local description="$1"
  local needle="$2"
  local haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    PASS=$((PASS+1))
    echo "  PASS: $description"
  else
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$description (missing: '$needle')")
    echo "  FAIL: $description (missing: '$needle')"
  fi
}

assert_not_contains() {
  local description="$1"
  local needle="$2"
  local haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$description (unexpected: '$needle')")
    echo "  FAIL: $description (unexpected: '$needle')"
  else
    PASS=$((PASS+1))
    echo "  PASS: $description"
  fi
}

assert_size_lt() {
  local description="$1"
  local max="$2"
  local actual="$3"
  if [ "$actual" -lt "$max" ]; then
    PASS=$((PASS+1))
    echo "  PASS: $description ($actual < $max)"
  else
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$description ($actual >= $max)")
    echo "  FAIL: $description ($actual >= $max)"
  fi
}

# ============================================================
# Hook 1 : posttool-lint-check.sh
# ============================================================

echo ""
echo "=== posttool-lint-check.sh ==="

# Cas 1 : édition CLAUDE.md → invoque validate-agents-md.sh (warn stderr possible)
INPUT='{"tool_name":"Edit","file_path":"/opt/automecanik/app/CLAUDE.md"}'
echo "$INPUT" | bash scripts/claude-hooks/posttool-lint-check.sh > /tmp/h1-out 2> /tmp/h1-err
assert_exit "posttool CLAUDE.md edit → exit 0 (warn-only)" "0" "$?"

# Cas 2 : input vide → exit 0
echo "" | bash scripts/claude-hooks/posttool-lint-check.sh > /tmp/h1b-out 2> /tmp/h1b-err
assert_exit "posttool empty input → exit 0" "0" "$?"

# Cas 3 : rollback CLAUDE_HOOKS_DISABLE=1
INPUT='{"tool_name":"Edit","file_path":"/opt/automecanik/app/CLAUDE.md"}'
CLAUDE_HOOKS_DISABLE=1 bash scripts/claude-hooks/posttool-lint-check.sh <<<"$INPUT" > /tmp/h1c-out 2>&1
assert_exit "posttool CLAUDE_HOOKS_DISABLE=1 → exit 0 silent" "0" "$?"

# Cas 4 (sanity) : fichier non-matching → exit 0, no output
echo '{"tool_name":"Edit","file_path":"/opt/automecanik/app/log.md"}' \
  | bash scripts/claude-hooks/posttool-lint-check.sh > /tmp/h1d-out 2> /tmp/h1d-err
assert_exit "posttool non-matching file → exit 0" "0" "$?"

# ============================================================
# Hook 2 : sessionstart-workspace-context.sh
# ============================================================

echo ""
echo "=== sessionstart-workspace-context.sh ==="

# Hermétique : les alertes cron de la machine (hors manifest) ne doivent pas fausser
# la borne de taille du manifest mesurée ci-dessous.
export CRON_STATE_DIR
CRON_STATE_DIR=$(mktemp -d)

# Cas 1 : nominal depuis repo root → output contient sections attendues
OUT=$(bash scripts/claude-hooks/sessionstart-workspace-context.sh 2>/tmp/h2-err)
EXIT=$?
assert_exit "sessionstart nominal → exit 0" "0" "$EXIT"
assert_contains "sessionstart contient ## Workspace" "## Workspace" "$OUT"
assert_contains "sessionstart contient ## TOP" "## TOP" "$OUT"
assert_contains "sessionstart contient ## DO NOT start" "## DO NOT start" "$OUT"

# Cas 2 : borne taille — output < 2000 bytes
SIZE=$(echo -n "$OUT" | wc -c)
assert_size_lt "sessionstart output bounded" "2000" "$SIZE"

# Cas 3 : rollback CLAUDE_HOOKS_DISABLE=1 → output vide, exit 0
OUT=$(CLAUDE_HOOKS_DISABLE=1 bash scripts/claude-hooks/sessionstart-workspace-context.sh 2>/tmp/h2c-err)
EXIT=$?
assert_exit "sessionstart CLAUDE_HOOKS_DISABLE=1 → exit 0" "0" "$EXIT"
if [ -z "$OUT" ]; then
  PASS=$((PASS+1))
  echo "  PASS: sessionstart CLAUDE_HOOKS_DISABLE=1 → output vide"
else
  FAIL=$((FAIL+1))
  FAILED_TESTS+=("sessionstart CLAUDE_HOOKS_DISABLE=1 should emit nothing")
  echo "  FAIL: sessionstart CLAUDE_HOOKS_DISABLE=1 should emit nothing"
fi

# ============================================================
# Hook 2b : état des crons — cron_report (lib) → alerte SessionStart
# ============================================================

echo ""
echo "=== cron_report + alertes cron SessionStart ==="

# cron_report dans un sous-shell isolé : run_report <state_dir> <max_age|-> <args cron_report…>
run_report() {
  local dir="$1" max_age="$2"; shift 2
  (
    CRON_STATE_DIR="$dir"
    CRON_REPORT_MAX_AGE_S=""
    [ "$max_age" = "-" ] || CRON_REPORT_MAX_AGE_S="$max_age"
    # shellcheck disable=SC1091
    source scripts/cron/lib-supabase-report.sh
    cron_report "$@"
  )
}
state() { jq -c "$2" "$1" 2>/dev/null; }
run_hook() { CRON_STATE_DIR="$1" bash scripts/claude-hooks/sessionstart-workspace-context.sh 2>/dev/null; }

D=$(mktemp -d)

# Lib — enregistrement nominal
run_report "$D" - t-ok ok 3 '{"a":1}' "" 2>/tmp/cr-err
assert_exit "cron_report ok → exit 0" "0" "$?"
assert_contains "cron_report ok → status, streak 1, métriques fournies CONSERVÉES (bug \${4:-{}}), max_age null" \
  '"ok",1,1,null' "$(state "$D/t-ok.json" '[.status,.streak,.metrics.a,.max_age_s]')"

# Lib — série : même statut → streak incrémenté, début conservé ; changement → reset
run_report "$D" 1800 t-err error 1 '{}' "boom" 2>/dev/null
SINCE1=$(state "$D/t-err.json" '.since')
run_report "$D" 1800 t-err error 1 '{}' "boom" 2>/dev/null
assert_contains "cron_report error×2 → streak 2" '^2$' "$(state "$D/t-err.json" '.streak')"
assert_contains "cron_report error×2 → since du 1er échec conservé" "^${SINCE1}$" "$(state "$D/t-err.json" '.since')"
assert_contains "cron_report → max_age_s déclaré enregistré" '^1800$' "$(state "$D/t-err.json" '.max_age_s')"
run_report "$D" 1800 t-err ok 1 '{}' "" 2>/dev/null
assert_contains "cron_report error→ok → streak remis à 1" '^1$' "$(state "$D/t-err.json" '.streak')"

# Lib — métriques invalides → {} ; statut invalide / dossier non inscriptible → signalé, exit 0
run_report "$D" - t-met ok 1 'pas du json' "" 2>/dev/null
assert_contains "cron_report metrics invalides → {}" '^{}$' "$(state "$D/t-met.json" '.metrics')"
run_report "$D" - t-bad degraded 1 '{}' "" 2>/tmp/cr-err
assert_exit "cron_report statut invalide → exit 0" "0" "$?"
assert_contains "cron_report statut invalide → signalé sur stderr" "NON enregistré" "$(cat /tmp/cr-err)"
assert_exit "cron_report statut invalide → aucun fichier" "absent" "$([ -e "$D/t-bad.json" ] && echo present || echo absent)"
run_report "/proc/cron-report-test" - t-ro ok 1 '{}' "" 2>/tmp/cr-err
assert_exit "cron_report dossier non inscriptible → exit 0" "0" "$?"
assert_contains "cron_report dossier non inscriptible → signalé sur stderr" "non inscriptible" "$(cat /tmp/cr-err)"

# Hook — état sain et frais → aucune alerte
H=$(mktemp -d)
run_report "$H" 1800 sync-ok ok 2 '{}' "" 2>/dev/null
OUT=$(run_hook "$H"); EXIT=$?
assert_exit "sessionstart état cron sain → exit 0" "0" "$EXIT"
assert_not_contains "sessionstart état cron sain → aucune alerte" "⚠️ cron" "$OUT"

# Hook — échec en cours → ÉCHEC + raison
run_report "$H" 1800 sync-ko error 0 '{}' "working tree sale — resync refusée" 2>/dev/null
OUT=$(run_hook "$H")
assert_contains "sessionstart cron en error → alerte ÉCHEC" "cron sync-ko : ÉCHEC depuis" "$OUT"
assert_contains "sessionstart cron en error → raison citée" "working tree sale" "$OUT"
assert_contains "sessionstart manifest toujours émis malgré l'alerte" "## Workspace" "$OUT"

# Hook — cron muet au-delà de max_age_s (aucun tick depuis 4000 s pour 1800 attendus)
jq -n --argjson ts "$(( $(date +%s) - 4000 ))" \
  '{job:"sync-mute",status:"ok",ts:$ts,since:$ts,streak:1,duration_s:1,max_age_s:1800,summary:"",metrics:{}}' \
  > "$H/sync-mute.json"
OUT=$(run_hook "$H")
assert_contains "sessionstart cron muet → alerte MUET" "cron sync-mute : MUET depuis" "$OUT"

# Hook — état corrompu → signalé, hook non bloqué
echo '{pas du json' > "$H/zz-corrupt.json"
OUT=$(run_hook "$H"); EXIT=$?
assert_exit "sessionstart état corrompu → exit 0" "0" "$EXIT"
assert_contains "sessionstart état corrompu → signalé" "état illisible" "$OUT"

# Hook — plus de 3 alertes → borné à 3 lignes + résumé
run_report "$H" - warn-x warn 0 '{}' "disque 85 %" 2>/dev/null
OUT=$(run_hook "$H")
assert_contains "sessionstart >3 alertes → résumé +N" "+1 autre(s)" "$OUT"

# Hook — avertissement seul → AVERTISSEMENT
W=$(mktemp -d)
run_report "$W" - disk warn 0 '{}' "disque 85 %" 2>/dev/null
OUT=$(run_hook "$W")
assert_contains "sessionstart cron en warn → alerte AVERTISSEMENT" "cron disk : AVERTISSEMENT depuis" "$OUT"

rm -rf "$D" "$H" "$W"

# sync-dev-runtime.sh de bout en bout, dans un bac à sable : dépôt git local, aucun réseau,
# `npm run build` factice, santé HTTP remplacée par une URL file:// qui répond.
echo ""
echo "=== sync-dev-runtime.sh : issue enregistrée (bac à sable) ==="

SB=$(mktemp -d)
commit_sb() { git -c user.name=test -c user.email=test@example.invalid commit -qm "$1"; }
git init -q --bare "$SB/origin.git"
git clone -q "$SB/origin.git" "$SB/app" 2>/dev/null
(
  cd "$SB/app" || exit 1
  git checkout -q -B main
  mkdir -p scripts/cron scripts/ops
  cp "$REPO_ROOT/scripts/cron/lib-supabase-report.sh" scripts/cron/
  cp "$REPO_ROOT/scripts/ops/sync-dev-runtime.sh" scripts/ops/
  # build : note les arguments que la synchro lui passe (lus après le cas 1).
  printf '{"name":"sandbox","private":true,"scripts":{"build":"echo >\\"$TMPDIR/build-args\\""}}\n' > package.json
  git add -A && commit_sb init && git push -q origin main
)
mkdir -p "$SB/app/backend/dist"
git clone -q -b main "$SB/origin.git" "$SB/up" 2>/dev/null
mkdir -p "$SB/tmp" "$SB/crash"
# TMPDIR : logs de build et sauvegardes untracked restent dans le bac à sable, jamais
# mêlés à ceux des vrais ticks cron dans /tmp. CRASH_DIR : les dumps de la machine
# n'influencent pas l'issue. SB_HEALTH_URL : santé simulée à terre (cas 4).
run_sync() {
  APP_DIR="$SB/app" HEALTH_URL="${SB_HEALTH_URL:-file://$SB/app/package.json}" CRASH_DIR="$SB/crash" \
    CRON_STATE_DIR="$SB/state" TMPDIR="$SB/tmp" \
    bash "$SB/app/scripts/ops/sync-dev-runtime.sh" >"$SB/out" 2>"$SB/err"
}

# 1. Collision untracked écartée (alerte sans abort) → tick au bout, issue `warn`
( cd "$SB/up" && echo amont > collide.txt && git add collide.txt && commit_sb "ajout amont" && git push -q origin main )
echo local > "$SB/app/collide.txt"
run_sync; EXIT=$?
assert_exit "sync bac à sable : collision untracked → tick au bout (exit 0)" "0" "$EXIT"
assert_contains "sync bac à sable : alerte sans abort → issue warn (plus ok)" '"warn"' "$(state "$SB/state/sync-dev-runtime.json" '.status')"
assert_contains "sync bac à sable : l'alerte est dans l'état enregistré" "1 alerte(s) : fichiers untracked en collision" "$(state "$SB/state/sync-dev-runtime.json" '.summary')"
# Le build de la synchro exclut le backend : son `prebuild: rimraf dist` supprimait le
# répertoire surveillé par nodemon, DEV:3000 restait à terre (2026-09-11, 07:20 et 13:50).
assert_contains "sync bac à sable : build lancé sans le backend (backend/dist appartient au stack dev)" \
  '^--filter=!@fafa/backend$' "$(cat "$SB/tmp/build-args" 2>/dev/null)"

# 2. Tick suivant sans alerte → `ok`, série remise à 1
run_sync; EXIT=$?
assert_exit "sync bac à sable : tick no-op → exit 0" "0" "$EXIT"
assert_contains "sync bac à sable : tick sans alerte → issue ok, série 1" '"ok",1' "$(state "$SB/state/sync-dev-runtime.json" '[.status,.streak]')"

# 3. Alerte puis abort (build cassé) → `error` portant l'abort ET l'alerte précédente
( cd "$SB/up" && echo amont2 > collide2.txt \
  && printf '{"name":"sandbox","private":true,"scripts":{"build":"false"}}\n' > package.json \
  && git add -A && commit_sb "casse le build" && git push -q origin main )
echo local2 > "$SB/app/collide2.txt"
run_sync; EXIT=$?
assert_exit "sync bac à sable : build cassé → abort (exit 1)" "1" "$EXIT"
assert_contains "sync bac à sable : abort → issue error + alerte précédente" \
  "npm run build échoué.*alertes précédentes : fichiers untracked en collision" "$(state "$SB/state/sync-dev-runtime.json" '.summary')"

# Sonde runtime (6e axe), à chaque tick. Faux processus du stack : node prend le titre d'un
# process npm, avec le même remplissage d'octets nuls que npm, et écrit son pid ; un 3e
# argument lui fait lancer une tâche enfant de ce titre.
# Toujours lancé en arrière-plan (`&`) : le `exec` remplace le sous-shell du job, si bien que
# le parent de node est le banc — ou PID 1 quand le job est détaché par `( … & )`.
spawn_titled() { # $1 cwd, $2 titre, $3 fichier pid, [$4 titre de l'enfant]
  cd "$1" && exec node -e '
      const [title, pidfile, child] = process.argv.slice(1);
      process.title = title;
      if (child) require("child_process").spawn(process.execPath,
        ["-e", "process.title = process.argv[1]; setTimeout(() => {}, 120000)", child], { stdio: "ignore" });
      require("fs").writeFileSync(pidfile, String(process.pid));
      setTimeout(() => {}, 120000);' "$2" "$3" "${4:-}"
}
wait_pid() { local i; for i in $(seq 50); do [ -s "$1" ] && { sleep 0.3; cat "$1"; return; }; sleep 0.1; done; }
kill_tree() {
  local p
  for p in "$@"; do pkill -P "$p"; kill "$p"; wait "$p"; done 2>/dev/null
}
sync_state() { state "$SB/state/sync-dev-runtime.json" "$1"; }

run_sync
assert_contains "sonde : tick de référence (git synchronisé, rien à signaler) → ok" '"ok"' "$(sync_state '.status')"

# 4. Runtime à terre, git synchronisé → `warn` (cas réel du 2026-09-11 : DEV:3000 à terre de
#    07:20 à 11:11 sans signal — le no-op ne sondait pas la santé)
SB_HEALTH_URL="file://$SB/absent" run_sync; EXIT=$?
assert_exit "sonde : runtime à terre → tick au bout (alert-only, exit 0)" "0" "$EXIT"
assert_contains "sonde : runtime à terre → issue warn « runtime DOWN »" '"warn".*runtime DOWN' "$(sync_state '[.status,.summary]')"

# 5. Stack sain : une racine « npm run dev » et sa tâche → `ok`
spawn_titled "$SB/app/backend" "npm run dev" "$SB/root1.pid" "npm run dev:watch" &
ROOT1=$(wait_pid "$SB/root1.pid")
assert_contains "sonde : le faux stack porte le titre exact de npm" "^npm run dev$" "$(ps -o args= -p "$ROOT1")"
assert_not_contains "sonde : pgrep '^npm run dev\$' ne voit pas cette racine (octets nuls de npm)" "^$ROOT1$" "$(pgrep -f '^npm run dev$')"
run_sync
assert_contains "sonde : stack sain (1 racine + sa tâche) → ok" '"ok"' "$(sync_state '.status')"

# 6. Deux racines supervisées → stacks concurrents
spawn_titled "$SB/app" "npm run dev" "$SB/root2.pid" &
ROOT2=$(wait_pid "$SB/root2.pid")
run_sync
assert_contains "sonde : 2 racines supervisées → warn CONCURRENTS" '"warn".*stacks dev CONCURRENTS : 2 racine' "$(sync_state '[.status,.summary]')"
kill_tree "$ROOT1" "$ROOT2"

# 7. Superviseur mort : racine reparentée à PID 1, seule → MORT, pas CONCURRENTS
( spawn_titled "$SB/app/backend" "npm run dev" "$SB/orphan.pid" & )
ORPHAN=$(wait_pid "$SB/orphan.pid")
assert_contains "sonde : précondition — le processus détaché est reparenté à PID 1" "^ *1$" "$(ps -o ppid= -p "$ORPHAN")"
run_sync
assert_contains "sonde : racine orpheline → warn superviseur MORT" '"warn".*superviseur dev MORT' "$(sync_state '[.status,.summary]')"
assert_not_contains "sonde : orpheline seule → pas de CONCURRENTS" "CONCURRENTS" "$(sync_state '.summary')"

# 8. Orpheline + stack relancé à côté → les deux alertes
spawn_titled "$SB/app/backend" "npm run dev" "$SB/root3.pid" "npm run dev:watch" &
ROOT3=$(wait_pid "$SB/root3.pid")
run_sync
assert_contains "sonde : orpheline + stack relancé → CONCURRENTS (1 supervisée, 1 orpheline)" \
  "superviseur dev MORT.*CONCURRENTS : 1 racine(s) supervisée(s).*et 1 orpheline" "$(sync_state '.summary')"
kill_tree "$ORPHAN" "$ROOT3"
run_sync
assert_contains "sonde : faux stacks arrêtés → ok" '"ok"' "$(sync_state '.status')"

# 9. Crash dump du stack : signalé à chaque tick tant qu'il a moins de 24 h, puis plus
touch "$SB/crash/_usr_bin_node.1000.crash" "$SB/crash/_usr_bin_python3.1000.crash"
run_sync
assert_contains "sonde : dump node frais → warn crash dump" '"warn".*_usr_bin_node.1000.crash' "$(sync_state '[.status,.summary]')"
assert_not_contains "sonde : dump hors stack (python) ignoré" "python3" "$(sync_state '.summary')"
run_sync
assert_contains "sonde : dump encore frais au tick suivant → toujours warn (série 2, pas effacé)" '"warn",2' "$(sync_state '[.status,.streak]')"
touch -d '25 hours ago' "$SB/crash/_usr_bin_node.1000.crash"
run_sync
assert_contains "sonde : dump de plus de 24 h → ok" '"ok"' "$(sync_state '.status')"

rm -rf "$SB"

# backend/wait-and-start.js (dev:watch du stack DEV) : une modification de backend/.env relance
# l'app sans tuer le script — sa mort fait arrêter par run-p toute la chaîne (tsc, tsc-alias,
# nodemon). Vrai script, lancé dans un bac à sable : `ps`, `ss` et `docker` y sont factices,
# sinon son nettoyage de démarrage tuerait les watchers tsc du stack dev de la machine.
WS=$(mktemp -d)
mkdir -p "$WS/backend/dist" "$WS/bin"
cp "$REPO_ROOT/backend/wait-and-start.js" "$WS/backend/"
echo "SANDBOX=1" > "$WS/backend/.env"
echo 'require("fs").appendFileSync(__dirname + "/../../boots.log", "boot\n"); setInterval(() => {}, 1e9);' > "$WS/backend/dist/main.js"
printf '#!/bin/sh\nexit 0\n' > "$WS/bin/ps"
cp "$WS/bin/ps" "$WS/bin/ss"
printf '#!/bin/sh\necho "Up 1 hour"\n' > "$WS/bin/docker"
printf '#!/bin/sh\nexec node %s "$@"\n' "$(cd "$REPO_ROOT" && node -p 'require.resolve("nodemon/bin/nodemon.js")')" > "$WS/bin/nodemon"
chmod +x "$WS/bin/"*
boots() { wc -l < "$WS/boots.log" 2>/dev/null || echo 0; }
wait_boots() { local i; for i in $(seq $(( $2 * 10 ))); do [ "$(boots)" -ge "$1" ] && return; sleep 0.1; done; }
alive() { [ -n "$(ps -o stat= -p "$1" 2>/dev/null | grep -v Z)" ] && echo vivant || echo mort; }
# stdin ouvert comme dans le terminal ; setsid : un groupe de processus à tuer d'un bloc.
mkfifo "$WS/stdin" && exec 7<>"$WS/stdin"
(cd "$WS/backend" && PATH="$WS/bin:$PATH" exec setsid node wait-and-start.js <&7 >"$WS/out" 2>&1) &
WPID=$!
wait_boots 1 30
assert_contains "wait-and-start : l'app démarre sous nodemon (bac à sable)" "^1$" "$(boots)"
echo "SANDBOX=2" >> "$WS/backend/.env"
wait_boots 2 15
assert_contains "wait-and-start : backend/.env modifié → l'app redémarre" "^2$" "$(boots)"
assert_contains "wait-and-start : backend/.env modifié → le script reste vivant (la chaîne dev survit)" "vivant" "$(alive "$WPID")"
kill -- -"$WPID" 2>/dev/null
wait "$WPID" 2>/dev/null
exec 7>&-
rm -rf "$WS"

# scripts/ops/dev-compile-watch.js (dev:compile du stack DEV) : UN seul processus compile et
# réécrit les @alias en chemins relatifs. Bac à sable : mini-projet TypeScript avec un alias,
# node_modules symlinké vers le repo (mêmes typescript et tsc-alias que le backend).
DW=$(mktemp -d)
mkdir -p "$DW/src/common"
# node_modules du dépôt (un worktree n'en a pas : on remonte jusqu'au checkout qui en a un).
DW_NM=""; d="$REPO_ROOT"
while [ "$d" != "/" ]; do [ -d "$d/node_modules/typescript" ] && { DW_NM="$d/node_modules"; break; }; d=$(dirname "$d"); done
[ -n "$DW_NM" ] || { FAIL=$((FAIL + 1)); FAILED_TESTS+=("dev-compile-watch : node_modules introuvable (npm ci requis)"); echo "  FAIL: dev-compile-watch : node_modules introuvable (npm ci requis)"; }
ln -s "$DW_NM" "$DW/node_modules"
cp "$REPO_ROOT/scripts/ops/dev-compile-watch.js" "$DW/"
cat > "$DW/tsconfig.json" <<'TSCONFIG'
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true,
    "types": [],
    "paths": { "@common/*": ["./src/common/*"] }
  },
  "include": ["src/**/*.ts"]
}
TSCONFIG
printf 'import { greet } from "@common/greet";\nexport const hello = greet("dev");\n' > "$DW/src/main.ts"
printf 'export const greet = (name: string) => `bonjour ${name}`;\n' > "$DW/src/common/greet.ts"
dw_wait() { local i; for i in $(seq $(( ${2:-30} * 10 ))); do grep -q "$1" "$DW/dist/main.js" 2>/dev/null && return 0; sleep 0.1; done; return 1; }
dw_residuals() { grep -rlE 'require\("@common/' --include='*.js' "$DW/dist" 2>/dev/null | wc -l; }
(cd "$DW" && exec node dev-compile-watch.js > "$DW/out" 2>&1) &
DWPID=$!
dw_wait 'require("./common/greet")' 90
assert_contains "dev-compile-watch : premier cycle, alias réécrit en relatif" 'require("./common/greet")' "$(cat "$DW/dist/main.js" 2>/dev/null)"
# Pas de second écrivain sur dist/ : le processus de compilation n'a aucun enfant.
assert_contains "dev-compile-watch : aucun second processus lancé (pas de watcher séparé)" "^0$" "$(pgrep -P "$DWPID" 2>/dev/null | wc -l)"
printf 'export const extra = "x";\n' > "$DW/src/common/extra.ts"
printf 'import { extra } from "@common/extra";\nexport const e = extra;\n' >> "$DW/src/main.ts"
dw_wait 'require("./common/extra")' 90
assert_contains "dev-compile-watch : module ajouté en cours de session, alias résolu" 'require("./common/extra")' "$(cat "$DW/dist/main.js" 2>/dev/null)"
assert_contains "dev-compile-watch : aucun @alias résiduel dans dist" "^0$" "$(dw_residuals)"
assert_contains "dev-compile-watch : le processus unique survit aux cycles" "vivant" "$(kill -0 "$DWPID" 2>/dev/null && echo vivant || echo mort)"
kill "$DWPID" 2>/dev/null
wait "$DWPID" 2>/dev/null
rm -rf "$DW"

# ============================================================
# Hook 3 : stop-claude-md-suggest.sh
# ============================================================

echo ""
echo "=== stop-claude-md-suggest.sh ==="

# Cas 1 : nominal sur branche feature → exit 0 (peut émettre ou non selon count fix)
bash scripts/claude-hooks/stop-claude-md-suggest.sh > /tmp/h3-out 2> /tmp/h3-err
assert_exit "stop-claude-md-suggest nominal → exit 0" "0" "$?"

# Cas 2 : rollback CLAUDE_HOOKS_DISABLE=1
CLAUDE_HOOKS_DISABLE=1 bash scripts/claude-hooks/stop-claude-md-suggest.sh > /tmp/h3b-out 2> /tmp/h3b-err
assert_exit "stop-claude-md-suggest CLAUDE_HOOKS_DISABLE=1 → exit 0" "0" "$?"
if [ ! -s /tmp/h3b-out ] && [ ! -s /tmp/h3b-err ]; then
  PASS=$((PASS+1))
  echo "  PASS: stop-claude-md-suggest CLAUDE_HOOKS_DISABLE=1 → silent"
else
  FAIL=$((FAIL+1))
  FAILED_TESTS+=("stop-claude-md-suggest should emit nothing when disabled")
  echo "  FAIL: stop-claude-md-suggest disabled should emit nothing"
fi

# Cas 3 : sur branche 'main' simulée (HEAD detached) → exit 0 (skip)
ORIG_HEAD=$(git rev-parse HEAD)
git checkout --detach >/dev/null 2>&1
bash scripts/claude-hooks/stop-claude-md-suggest.sh > /tmp/h3c-out 2> /tmp/h3c-err
RC=$?
git checkout - >/dev/null 2>&1
assert_exit "stop-claude-md-suggest detached HEAD → exit 0 skip" "0" "$RC"

# ============================================================
# Validator : validate-top-priorities.sh
# ============================================================

echo ""
echo "=== validate-top-priorities.sh ==="

bash scripts/governance/validate-top-priorities.sh .claude/top-priorities.md > /tmp/v1-out 2>&1
assert_exit "validate-top-priorities nominal → exit 0" "0" "$?"

# Cas 2 : fichier inexistant
bash scripts/governance/validate-top-priorities.sh /tmp/nonexistent.md > /tmp/v2-out 2>&1
assert_exit "validate-top-priorities missing file → exit 1" "1" "$?"

# Cas 3 : sur-dépassement borne TOP (créer fichier temporaire)
cat > /tmp/top-bloat.md <<'EOF'
## TOP
- a
- b
- c
- d
- e
- f
- g

## DO_NOT_START
- x

## ACTIVE_INCIDENTS
- y

## STRUCTURAL_CONSTRAINTS
- z
EOF
bash scripts/governance/validate-top-priorities.sh /tmp/top-bloat.md > /tmp/v3-out 2>&1
assert_exit "validate-top-priorities TOP>5 → exit 1" "1" "$?"
assert_contains "validate-top-priorities flags TOP overflow" "TOP a 7" "$(cat /tmp/v3-out)"

# ============================================================
# Guard : pretool-bash-guard.sh — Guard 6 (tag v* = PROD deploy trigger)
# ============================================================

echo ""
echo "=== pretool-bash-guard.sh (Guard 6 tag PROD) ==="

run_bash_guard() {
  echo "{\"command\":\"$1\"}" | bash scripts/claude-hooks/pretool-bash-guard.sh >/dev/null 2>&1
  echo $?
}

# BLOCK : créations/pushes de tag v* (déclencheur deploy PROD)
assert_exit "bash-guard: git tag v1.2.3 → BLOCK"           "2" "$(run_bash_guard 'git tag v1.2.3')"
assert_exit "bash-guard: git tag -a v1.2.3 -m rel → BLOCK" "2" "$(run_bash_guard 'git tag -a v1.2.3 -m rel')"
assert_exit "bash-guard: git tag -s v2.0.0 → BLOCK"        "2" "$(run_bash_guard 'git tag -s v2.0.0')"
assert_exit "bash-guard: git push origin v1.2.3 → BLOCK"   "2" "$(run_bash_guard 'git push origin v1.2.3')"
assert_exit "bash-guard: git push --tags → BLOCK"          "2" "$(run_bash_guard 'git push --tags')"
# ALLOW : pas de faux positif sur les usages git courants
assert_exit "bash-guard: git tag (list) → allow"           "0" "$(run_bash_guard 'git tag')"
assert_exit "bash-guard: push feature branch → allow"      "0" "$(run_bash_guard 'git push origin feat/foo')"
assert_exit "bash-guard: git status → allow"               "0" "$(run_bash_guard 'git status')"
# Sanity : guard existant (Guard 1) toujours actif
assert_exit "bash-guard: git push origin main → BLOCK (G1)" "2" "$(run_bash_guard 'git push origin main')"

# ============================================================
# Guard : pretool-supabase-guard.sh — Guard 6 (DML direct sur tables gouvernées)
# ============================================================

echo ""
echo "=== pretool-supabase-guard.sh (Guard 6 DML) ==="

run_sql_guard() {
  echo "{\"query\":\"$1\"}" | bash scripts/claude-hooks/pretool-supabase-guard.sh >/dev/null 2>&1
  echo $?
}

# BLOCK : DML brut sur pieces / pieces_price / __seo_*
assert_exit "sql-guard: UPDATE pieces_price → BLOCK"           "2" "$(run_sql_guard 'UPDATE pieces_price SET pri_dispo=1')"
assert_exit "sql-guard: UPDATE pieces → BLOCK"                 "2" "$(run_sql_guard 'UPDATE pieces SET x=1 WHERE id=1')"
assert_exit "sql-guard: DELETE FROM __seo_keywords → BLOCK"    "2" "$(run_sql_guard 'DELETE FROM __seo_keywords WHERE id=1')"
assert_exit "sql-guard: lowercase update public.pieces_price → BLOCK" "2" "$(run_sql_guard 'update public.pieces_price set x=1')"
# ALLOW : pas de faux positif (autre table pieces_*, SELECT, INSERT hors scope owner)
assert_exit "sql-guard: UPDATE pieces_relation_type → allow"  "0" "$(run_sql_guard 'UPDATE pieces_relation_type SET x=1')"
assert_exit "sql-guard: SELECT FROM pieces → allow"           "0" "$(run_sql_guard 'SELECT * FROM pieces')"
assert_exit "sql-guard: INSERT pieces_price → allow (scope=UPDATE/DELETE)" "0" "$(run_sql_guard 'INSERT INTO pieces_price (id) VALUES (1)')"
# Sanity : guard existant (Guard 1) toujours actif
assert_exit "sql-guard: DROP TABLE foo (no IF EXISTS) → BLOCK (G1)" "2" "$(run_sql_guard 'DROP TABLE foo')"

# ============================================================
# Résumé
# ============================================================

echo ""
echo "======================================"
echo "Tests : $PASS passed / $FAIL failed"
echo "======================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Échecs :"
  for t in "${FAILED_TESTS[@]}"; do
    echo "  - $t"
  done
  exit 1
fi

exit 0
