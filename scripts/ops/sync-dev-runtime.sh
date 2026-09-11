#!/usr/bin/env bash
# ==============================================================================
# sync-dev-runtime.sh — garde DEV:3000 aligné sur origin/main
#
# CONTEXTE (cf. mémoire feedback_dev_runtime_parity_4_gaps + deployment.md) :
#   DEV (46.224.118.55:3000) = environnement réel de dev/tests/MESURES, servi par
#   `npm run dev` (nodemon) DEPUIS CE working tree. Le merge `main` ne met à jour
#   que le container PREPROD — JAMAIS DEV:3000. Ce script comble ce trou : il
#   resynchronise le runtime DEV sur `origin/main` après chaque merge.
#
# PHILOSOPHIE : alerter, jamais casser. Si une dérive non auto-réparable est
#   détectée (env, version Node, migration, branche, working tree sale), le
#   script ABORTE proprement + alerte — il ne laisse jamais DEV dans un état pire.
#   Il n'upgrade PAS Node et n'applique PAS de migration DB (actions manuelles,
#   trop risquées en cron sur une DB partagée).
#
# Idempotent : no-op si le SHA local == origin/main. Conçu pour tourner en cron
#   (~10 min) sur la box DEV, crontab de l'utilisateur deploy :
#     */10 * * * * /usr/bin/bash /opt/automecanik/app/scripts/ops/sync-dev-runtime.sh >> /tmp/sync-dev-runtime-cron.log 2>&1
#   Le `2>&1` est requis : les alertes et les aborts partent sur stderr, et la
#   machine n'a pas de MTA — sans lui, cron les jette.
#
# OBSERVABILITÉ : chaque tick (sync, no-op ou abort) enregistre son issue via
#   `cron_report` (scripts/cron/lib-supabase-report.sh) : error (abort), warn (tick
#   arrivé au bout mais avec alerte), ok. Le hook SessionStart alerte ensuite toute
#   session Claude de la machine sur error/warn, ou si aucun tick n'a tourné depuis
#   CRON_REPORT_MAX_AGE_S (cron arrêté).
# ==============================================================================
set -uo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
APP_DIR="${APP_DIR:-/opt/automecanik/app}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/health}"
# Dumps apport de la machine (lus par nom + mtime seulement, cf. check_dev_runtime_topology).
CRASH_DIR="${CRASH_DIR:-/var/crash}"
# Un dump reste signalé à chaque tick pendant 24 h (ou jusqu'à sa suppression après analyse).
CRASH_ALERT_WINDOW_MIN=1440
LOG_TAG="sync-dev-runtime"
START=$(date +%s)
# Trois ticks manqués (cadence 10 min) = cron considéré arrêté.
CRON_REPORT_MAX_AGE_S=1800

cd "$APP_DIR" 2>/dev/null || { echo "[$LOG_TAG] FATAL: $APP_DIR introuvable" >&2; exit 1; }

# shellcheck disable=SC1091
source scripts/cron/lib-supabase-report.sh 2>/dev/null || true

log()   { echo "[$LOG_TAG] $(date -u +%FT%TZ) $1"; }
# Alertes émises pendant ce tick. Une alerte qui n'interrompt pas le tick (dérive Node,
# fichiers untracked écartés…) passe l'issue enregistrée de `ok` à `warn` — sans quoi
# seul le log en gardait la trace et le hook SessionStart ne la voyait jamais.
RUN_ALERTS=()
alert() {
  echo "[$LOG_TAG] $(date -u +%FT%TZ) ⚠️ ALERT: $1" >&2
  RUN_ALERTS+=("$1")
  [ -n "${ALERT_WEBHOOK_URL:-}" ] && curl -sf --max-time 5 -X POST "$ALERT_WEBHOOK_URL" \
    -H 'Content-Type: application/json' -d "{\"text\":\"[DEV sync] $1\"}" >/dev/null 2>&1 || true
}
join_alerts() { local joined; joined=$(printf ' | %s' "${RUN_ALERTS[@]}"); printf '%s' "${joined:3}"; }
# Pas de `2>/dev/null || true` ici : c'est ce qui rendait le rapport muet. cron_report
# ne fait jamais échouer le script et signale lui-même sur stderr un état non écrit.
report() {
  if ! command -v cron_report >/dev/null 2>&1; then
    echo "[$LOG_TAG] ⚠️ cron_report indisponible (scripts/cron/lib-supabase-report.sh non chargée) — issue du tick NON enregistrée" >&2
    return 0
  fi
  cron_report "$LOG_TAG" "$1" "$(( $(date +%s) - START ))" "${2:-}" "${3:-}"
}
# Issue d'un tick arrivé au bout : `ok`, ou `warn` portant les alertes émises en route.
report_done() {
  if [ "${#RUN_ALERTS[@]}" -gt 0 ]; then
    report "warn" "$1" "${#RUN_ALERTS[@]} alerte(s) : $(join_alerts)"
  else
    report "ok" "$1" ""
  fi
}
# L'abort enregistre aussi les alertes qui l'ont précédé (ex. le détail d'une dérive
# workspaces, que son message résume par « cf. alerts ci-dessus »).
abort() {
  local ctx=""
  [ "${#RUN_ALERTS[@]}" -gt 0 ] && ctx=" — alertes précédentes : $(join_alerts)"
  alert "$1"
  report "error" "{}" "$1$ctx"
  exit 1
}

# 5e axe de dérive — Workspaces npm (drift install/dist).
# Détecte (sans corriger — canon no-silent-fallback) :
#   - packages/*/package.json sans symlink node_modules/<name>   → install manquant
#   - packages/* avec "main": "./dist/..." sans fichier dist/    → build manquant
# Pourquoi : npm install (étape 6) ne tourne que si package-lock.json change ;
# turbo build skip aussi un workspace si sa dépendance graph ne l'inclut pas.
# Un workspace fraîchement mergé peut donc rester invisible jusqu'au boot crash
# backend (cf. incident 2026-05-25 : @repo/domain-commerce + @repo/cwv-taxonomy
# présents sur disque mais sans symlinks ni dist → MODULE_NOT_FOUND).
# Sortie : exit 0 = sain · exit 1 = drift détecté (alerté avant retour).
check_workspace_integrity() {
  # Dépendance dure : `jq` est requis pour parser package.json sans heuristique
  # fragile. Faute explicite (pas un skip silencieux) — canon no-silent-fallback.
  command -v jq >/dev/null 2>&1 || {
    alert "jq absent — check_workspace_integrity ne peut pas s'exécuter (apt install jq)"
    return 2
  }

  local missing_links=() missing_dist=()
  local pkgdir pkg_name main_field

  for pkgdir in packages/*/; do
    [ -f "${pkgdir}package.json" ] || continue
    pkg_name=$(jq -r '.name // empty' "${pkgdir}package.json" 2>/dev/null)
    [ -n "$pkg_name" ] || continue

    if [ ! -e "node_modules/${pkg_name}" ]; then
      missing_links+=("$pkg_name")
      continue
    fi

    main_field=$(jq -r '.main // empty' "${pkgdir}package.json" 2>/dev/null)
    if [[ "$main_field" == *"/dist/"* ]]; then
      [ -f "${pkgdir}${main_field#./}" ] || missing_dist+=("$pkg_name")
    fi
  done

  local drift=0
  if [ "${#missing_links[@]}" -gt 0 ]; then
    alert "workspaces sans symlink node_modules (run: npm install) : ${missing_links[*]}"
    drift=1
  fi
  if [ "${#missing_dist[@]}" -gt 0 ]; then
    alert "workspaces sans dist compilé (run: npm run build) : ${missing_dist[*]}"
    drift=1
  fi
  return "$drift"
}

# ---------------------------------------------------------------------------
# Sonde de topologie runtime — 6e axe de dérive.
#
# POURQUOI ELLE EXISTE : le 2026-09-09 09:01:41, `turbo dev` (superviseur du
# stack DEV) est mort en SIGSEGV. Ses tâches persistantes ont survécu,
# reparentées à PID 1, et `:3000` a continué de répondre 200. Résultat : plus
# aucun superviseur, mais TOUS les signaux existants restaient au vert. La
# cause du crash est un bug amont (turbo 2.10.0, cf. PR #1424) — ce que cette
# sonde corrige, c'est le SILENCE, qui lui est local.
#
# CE QU'ELLE AJOUTE que /health ne peut pas voir : /health interroge le
# processus backend, pas la chaîne qui le supervise. Un superviseur mort avec
# enfants orphelins rend exactement le même 200 qu'un stack sain. Le seul
# signal qui distingue les deux est TOPOLOGIQUE (qui est le parent), pas HTTP.
#
# POURQUOI AVANT LES GARDES GIT (1 et 2) : la mort du superviseur est un fait
# runtime, sans rapport avec l'état git. Les gardes branche/working-tree font
# `abort` ; placée après elles, la sonde ne verrait jamais un incident survenu
# pendant qu'une branche feature ou un fichier modifié traîne dans le checkout.
# C'est précisément l'état du 2026-09-09 (branche feature + turbo.json modifié)
# : le cron abortait à l'étape 1 et n'a rien probé pendant ~10 h.
#
# ALERT-ONLY, JAMAIS `abort` : un abort ici stopperait les axes de resync git
# qui gardent DEV:3000 frais — on transformerait un incident d'observabilité en
# panne de synchronisation.
check_dev_runtime_topology() {
  local drift=0

  # (a) Santé HTTP à CHAQUE tick. L'unique appel à $HEALTH_URL du script vit
  #     dans l'étape 8, atteignable seulement sur le chemin de resync : quand
  #     HEAD == origin/main (le cas nominal) le script sortait sans avoir rien
  #     probé du runtime.
  #     Debounce volontaire (3 essais / 5 s) : nodemon coupe :3000 quelques
  #     secondes à chaque rebuild tsc. Sans ça le cron alerterait sur une
  #     fenêtre de redémarrage normale, et une alerte qui crie faux finit
  #     ignorée — exactement le mode de panne qu'on cherche à supprimer.
  local up=0 i
  for i in 1 2 3; do
    if curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then up=1; break; fi
    [ "$i" -lt 3 ] && sleep 5
  done
  if [ "$up" != "1" ]; then
    alert "DEV:3000 ne répond pas après 3 essais ($HEALTH_URL) — runtime DOWN"
    drift=1
  fi

  # Processus du stack dev de CE checkout, relevés en une passe (cwd dans le
  #     repo : un autre projet de la machine ne compte pas). Identification par
  #     titre exact : npm remplace son titre par « npm run <script> » complété
  #     d'octets nuls, que `pgrep -f` rend en espaces de fin — un motif ancré
  #     `^npm run dev$` n'y trouve JAMAIS la racine (mesuré le 2026-09-11 :
  #     0 résultat, stack en marche). `ps args=` rend le titre sans remplissage.
  local -A parent_of=() in_stack=()
  local stack=() pid ppid cmd cwd
  while read -r pid ppid cmd; do
    parent_of[$pid]=$ppid
    case "$cmd" in
      "npm run dev"|"npm run dev:"*|"turbo dev"|"turbo dev "*|*"/turbo dev"|*"/turbo dev "*) ;;
      *) continue ;;
    esac
    cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null) || continue
    case "$cwd" in
      "$APP_DIR"|"$APP_DIR"/*) stack+=("$pid"); in_stack[$pid]=1 ;;
    esac
  done < <(ps -eo pid=,ppid=,args= 2>/dev/null)

  # Racine = processus du stack sans ancêtre dans le stack. Un stack sain en a
  #     une seule, lancée depuis un terminal : turbo et les `npm run dev:*` en
  #     descendent. Remontée bornée (le relevé `ps` n'est pas atomique).
  local orphans=() roots=() p hops
  for pid in "${stack[@]}"; do
    p=${parent_of[$pid]:-0} hops=0
    while [ "$p" -gt 1 ] && [ -z "${in_stack[$p]:-}" ] && [ "$hops" -lt 64 ]; do
      p=${parent_of[$p]:-0} hops=$((hops + 1))
    done
    [ -n "${in_stack[$p]:-}" ] && continue
    if [ "${parent_of[$pid]}" = "1" ]; then orphans+=("$pid"); else roots+=("$pid"); fi
  done

  # (b) Superviseur mort, enfants orphelins. Signature exacte de l'incident :
  #     une racine de stack dev reparentée à PID 1. Dans un stack sain la
  #     racine a un parent shell/tmux/VS Code, jamais init.
  if [ "${#orphans[@]}" -gt 0 ]; then
    alert "superviseur dev MORT — ${#orphans[@]} racine(s) orpheline(s) reparentée(s) à PID 1 (pids: ${orphans[*]}). Le stack tourne sans superviseur : /health reste vert mais plus rien ne surveille les watchers. Cf. turbo 2.10.0 SIGSEGV au shutdown."
    drift=1
  fi

  # (c) Stacks dev concurrents. Après le crash du 2026-09-09, deux arbres
  #     `npm run dev` tournaient en parallèle sur le même backend/dist : deux
  #     tsc écrivant le même dist, deux nodemon le surveillant. État instable
  #     qu'aucun signal existant ne rendait visible. Concurrence = plus d'une
  #     racine supervisée, ou une racine supervisée à côté d'orphelines. Les
  #     orphelines seules (plusieurs tâches d'un même turbo mort) relèvent de (b).
  if [ "${#roots[@]}" -gt 1 ] || { [ "${#roots[@]}" -ge 1 ] && [ "${#orphans[@]}" -ge 1 ]; }; then
    alert "stacks dev CONCURRENTS : ${#roots[@]} racine(s) supervisée(s) (pids: ${roots[*]}) et ${#orphans[@]} orpheline(s) — elles se disputent backend/dist (tsc + nodemon en double). Une seule doit tourner."
    drift=1
  fi

  # (d) Crash dumps imputables au repo. La machine écrit déjà des dumps apport
  #     dans $CRASH_DIR ; personne ne les lit jamais (aucun script du repo ne
  #     référence /var/crash — vérifié). On ne lit PAS le contenu des dumps
  #     (pas de privilège requis) : uniquement nom + mtime.
  #     Signalé à CHAQUE tick tant que le dump a moins de CRASH_ALERT_WINDOW_MIN :
  #     l'issue enregistrée ne garde que le dernier tick, donc une alerte émise
  #     une seule fois serait effacée par le tick `ok` suivant, 10 min plus tard,
  #     avant qu'une session ne la voie. Supprimer le dump après analyse l'acquitte.
  if [ -d "$CRASH_DIR" ]; then
    local dumps
    dumps=$(find "$CRASH_DIR" -maxdepth 1 -name '*.crash' -mmin "-$CRASH_ALERT_WINDOW_MIN" 2>/dev/null \
            | grep -E 'automecanik|turbo|node' | sort || true)
    if [ -n "$dumps" ]; then
      alert "crash dump(s) de moins de $((CRASH_ALERT_WINDOW_MIN / 60)) h dans $CRASH_DIR : $(echo "$dumps" | tr '\n' ' ')— un process du stack a crashé. Inspecter avec: grep -a '^Date\|^Signal\|^ProcCmdline' <fichier> ; le supprimer après analyse acquitte l'alerte."
      drift=1
    fi
  fi

  return "$drift"
}

# 0. Sonde de topologie runtime (6e axe) — AVANT les gardes git, alert-only.
#    Voir l'en-tête de check_dev_runtime_topology pour le « pourquoi avant ».
check_dev_runtime_topology || true

# 1. Garde branche : le checkout runtime DOIT rester sur main (features = worktrees).
branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = "main" ] || abort "checkout sur '$branch' (pas main) — resync refusée (cf. convention worktree)"

# 2. Garde working tree sale (on tolère le bruit log.md du hook session-log).
dirty=$(git status --porcelain --untracked-files=no | grep -vE '(^| )log\.md$' || true)
[ -z "$dirty" ] || abort "working tree sale — resync refusée: $(echo "$dirty" | tr '\n' ' ')"

# 3. Fetch + comparer.
git fetch --quiet origin main || abort "git fetch échoué"
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse origin/main)
if [ "$local_sha" = "$remote_sha" ]; then
  # Pas de sync git — mais on probe quand même l'intégrité workspaces. Un drift
  # ici (symlink supprimé, dist effacé entre 2 ticks cron, install manuel
  # interrompu) doit être visible AVANT que nodemon redémarre et crashe.
  if ! check_workspace_integrity; then
    report "error" "{\"action\":\"workspace_drift_noop\",\"sha\":\"$local_sha\"}" "dérive workspaces sans changement git : $(join_alerts)"
    exit 1
  fi
  report_done "{\"action\":\"noop\",\"sha\":\"$local_sha\"}"
  exit 0
fi

# 4. Fast-forward only (jamais reset --hard ; une divergence = réconciliation manuelle).
# La garde l.96 "tolère" le bruit log.md dans le check de propreté, mais
# `git merge --ff-only` butait QUAND MÊME dessus quand log.md a aussi avancé en
# amont (refus d'écraser une modif locale) → le cron avortait en boucle ici =
# drift silencieux (31 commits observés le 2026-06-16, violation no-silent-fallback).
# On matérialise donc la tolérance : reset du SEUL log.md (régénéré par le hook
# session-log) avant le ff. Sûr — la garde l.96-97 a déjà refusé tout autre fichier
# sale ; jamais de `reset --hard`, seul ce fichier auto-généré est touché.
if ! git diff --quiet -- log.md 2>/dev/null; then
  git checkout --quiet -- log.md \
    && log "bruit log.md local réinitialisé avant ff (toléré, régénéré par session-log)"
fi
# Généralisation de la tolérance log.md (ci-dessus) à TOUTE collision de fichier
# untracked : `git merge --ff-only` avorte si un fichier AJOUTÉ en amont existe
# déjà localement en untracked (ex. skill workspace créé hors-git, observé le
# 2026-06-20 : DEV figé 3j / 34 commits). Sans ça = cron qui avorte en boucle =
# drift silencieux (même classe que l'incident log.md). On SAUVEGARDE (réversible,
# zéro perte) puis on continue ; l'alerte (stderr → MAILTO) rend l'éviction
# observable. Jamais de suppression : seulement un déplacement vers /tmp.
collisions=$(git diff --name-only --diff-filter=A "$local_sha".."$remote_sha" 2>/dev/null \
  | while IFS= read -r f; do
      [ -n "$f" ] && [ -e "$f" ] \
        && ! git ls-files --error-unmatch "$f" >/dev/null 2>&1 \
        && printf '%s\n' "$f"
    done)
if [ -n "$collisions" ]; then
  bkdir="${TMPDIR:-/tmp}/${LOG_TAG}-untracked-backup-$(date +%Y%m%d-%H%M%S)"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    mkdir -p "$bkdir/$(dirname "$f")" && mv "$f" "$bkdir/$f"
  done <<< "$collisions"
  alert "fichiers untracked en collision avec le ff — sauvegardés dans $bkdir puis écartés : $(printf '%s ' $collisions)"
fi
git merge --ff-only origin/main || abort "non fast-forwardable (lignée divergente) — réconcilier main à la main"
log "synced $local_sha → $remote_sha"

# 5. Garde parité Node (.nvmrc) — alerte seulement (upgrade = manuel via NodeSource).
want_major=$(tr -d 'v' < .nvmrc 2>/dev/null | cut -d. -f1)
have_major=$(node -v 2>/dev/null | tr -d 'v' | cut -d. -f1)
if [ -n "$want_major" ] && [ -n "$have_major" ] && [ "$want_major" != "$have_major" ]; then
  alert "dérive Node : v$have_major installé, .nvmrc=$want_major attendu — l'app peut crasher ; upgrade manuel requis (NodeSource setup_${want_major}.x)"
fi

# 6. npm ci si lockfile changé, puis build. Sorties capturées dans /tmp et
#    re-déversées (tail -50) sur stderr en cas d'échec — pas de silencement total
#    (canon no-silent-fallback). Logs gardés sur disque pour postmortem manuel.
#
#    `npm ci` (pas `npm install`) DÉLIBÉRÉMENT : DEV est un miroir read-only de
#    l'état COMMITTÉ de `main`. `npm install` réécrit les annotations du lockfile
#    (dev/peer/optional) selon le node_modules local → working tree sali → bloque
#    le ff-pull du run suivant (cause de la dérive 2026-06). `npm ci` est
#    déterministe : installe EXACTEMENT le lockfile committé, ne le réécrit JAMAIS
#    (échoue franc si package.json↔lockfile désync, ce qui aligne no-silent-fallback).
#    C'est aussi ce que fait la CI. Contrepartie assumée : `npm ci` purge
#    node_modules avant réinstall → un échec laisse DEV sans deps jusqu'au prochain
#    run ; le cron alerte déjà (abort ci-dessous) et re-tente au tick suivant (~10 min).
#
#    Build de tout le monorepo SAUF le backend : `backend/dist` appartient au stack dev
#    en marche (`tsc --build --watch` et `tsc-alias --watch` le recompilent depuis les
#    sources que le ff-merge vient de changer, nodemon le surveille). Le `build` du
#    backend commence par `prebuild: rimraf dist` : lancé ici, il supprime le répertoire
#    que surveille nodemon, qui perd tous ses watches inotify et ne relance plus jamais
#    l'app — DEV:3000 à terre jusqu'à relance manuelle (2026-09-11, 07:20 et 13:50, à
#    chaque cache turbo manqué du backend ; le `touch` de l'étape 7 n'y peut rien).
INSTALL_LOG="${TMPDIR:-/tmp}/${LOG_TAG}-npm-install-$$.log"
BUILD_LOG="${TMPDIR:-/tmp}/${LOG_TAG}-npm-build-$$.log"
if ! git diff --quiet "$local_sha" "$remote_sha" -- package-lock.json 2>/dev/null; then
  log "package-lock.json modifié → npm ci (install déterministe, log: $INSTALL_LOG)"
  if ! npm ci >"$INSTALL_LOG" 2>&1; then
    tail -50 "$INSTALL_LOG" >&2
    abort "npm ci échoué — log complet : $INSTALL_LOG"
  fi
fi
if ! npm run build -- --filter='!@fafa/backend' >"$BUILD_LOG" 2>&1; then
  tail -50 "$BUILD_LOG" >&2
  abort "npm run build échoué — log complet : $BUILD_LOG"
fi

# 6b. Probe d'intégrité workspaces post-build (5e axe). Si install/build sont
#     passés "verts" mais qu'un workspace reste sans symlink ou sans dist, c'est
#     un drift silencieux (turbo a skippé, lockfile pas refreshé, etc.). On
#     refuse de marquer ":3000 sain" sans l'avoir vérifié.
check_workspace_integrity || abort "drift workspaces après npm install + build — install/build incomplet (cf. alerts ci-dessus)"

# 7. Redémarrer le runtime : nodemon ne surveille que backend/dist, pas les dist des
#    workspaces que le build vient de réécrire — on force un boot qui les recharge.
touch backend/dist/main.js

# 8. Health check avec retries — un échec ici = dérive non auto-réparable (env manquant,
#    migration DB pendante, Node…). On alerte pour intervention manuelle, sans masquer.
healthy=0
for i in $(seq 1 12); do
  sleep 5
  if curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then healthy=1; break; fi
done
if [ "$healthy" != "1" ]; then
  abort ":3000 KO après resync vers $remote_sha — vérifier : env (env-validation.ts), migrations DB pendantes, version Node"
fi

log "✅ DEV:3000 sain sur $remote_sha"
report_done "{\"action\":\"synced\",\"from\":\"$local_sha\",\"to\":\"$remote_sha\"}"
exit 0
