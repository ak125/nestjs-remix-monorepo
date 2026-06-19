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
#   (~10 min) sur la box DEV. Voir crontab `* /10 * * * *`.
# ==============================================================================
set -uo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
APP_DIR="${APP_DIR:-/opt/automecanik/app}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/health}"
LOG_TAG="sync-dev-runtime"
START=$(date +%s)

cd "$APP_DIR" 2>/dev/null || { echo "[$LOG_TAG] FATAL: $APP_DIR introuvable" >&2; exit 1; }

# shellcheck disable=SC1091
source scripts/cron/lib-supabase-report.sh 2>/dev/null || true

log()   { echo "[$LOG_TAG] $1"; }
alert() {
  echo "[$LOG_TAG] ⚠️ ALERT: $1" >&2
  [ -n "${ALERT_WEBHOOK_URL:-}" ] && curl -sf --max-time 5 -X POST "$ALERT_WEBHOOK_URL" \
    -H 'Content-Type: application/json' -d "{\"text\":\"[DEV sync] $1\"}" >/dev/null 2>&1 || true
}
report() { command -v cron_report >/dev/null 2>&1 && cron_report "$LOG_TAG" "$1" "$(( $(date +%s) - START ))" "${2:-{}}" "${3:-}" 2>/dev/null || true; }
abort()  { alert "$1"; report "error" "{}" "$1"; exit 1; }

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
    report "error" "{\"action\":\"workspace_drift_noop\",\"sha\":\"$local_sha\"}" "workspace drift detected without git change"
    exit 1
  fi
  report "ok" "{\"action\":\"noop\",\"sha\":\"$local_sha\"}" ""
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
git merge --ff-only origin/main || abort "non fast-forwardable (lignée divergente) — réconcilier main à la main"
log "synced $local_sha → $remote_sha"

# 5. Garde parité Node (.nvmrc) — alerte seulement (upgrade = manuel via NodeSource).
want_major=$(tr -d 'v' < .nvmrc 2>/dev/null | cut -d. -f1)
have_major=$(node -v 2>/dev/null | tr -d 'v' | cut -d. -f1)
if [ -n "$want_major" ] && [ -n "$have_major" ] && [ "$want_major" != "$have_major" ]; then
  alert "dérive Node : v$have_major installé, .nvmrc=$want_major attendu — l'app peut crasher ; upgrade manuel requis (NodeSource setup_${want_major}.x)"
fi

# 6. npm install si lockfile changé, puis build. Sorties capturées dans /tmp et
#    re-déversées (tail -50) sur stderr en cas d'échec — pas de silencement total
#    (canon no-silent-fallback). Logs gardés sur disque pour postmortem manuel.
INSTALL_LOG="/tmp/${LOG_TAG}-npm-install-$$.log"
BUILD_LOG="/tmp/${LOG_TAG}-npm-build-$$.log"
if ! git diff --quiet "$local_sha" "$remote_sha" -- package-lock.json 2>/dev/null; then
  log "package-lock.json modifié → npm install (log: $INSTALL_LOG)"
  if ! npm install >"$INSTALL_LOG" 2>&1; then
    tail -50 "$INSTALL_LOG" >&2
    abort "npm install échoué — log complet : $INSTALL_LOG"
  fi
fi
if ! npm run build >"$BUILD_LOG" 2>&1; then
  tail -50 "$BUILD_LOG" >&2
  abort "npm run build échoué — log complet : $BUILD_LOG"
fi

# 6b. Probe d'intégrité workspaces post-build (5e axe). Si install/build sont
#     passés "verts" mais qu'un workspace reste sans symlink ou sans dist, c'est
#     un drift silencieux (turbo a skippé, lockfile pas refreshé, etc.). On
#     refuse de marquer ":3000 sain" sans l'avoir vérifié.
check_workspace_integrity || abort "drift workspaces après npm install + build — install/build incomplet (cf. alerts ci-dessus)"

# 7. Redémarrer le runtime (nodemon surveille dist ; le build l'a réécrit, on force un boot propre).
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
report "ok" "{\"action\":\"synced\",\"from\":\"$local_sha\",\"to\":\"$remote_sha\"}" ""
exit 0
