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
  report "ok" "{\"action\":\"noop\",\"sha\":\"$local_sha\"}" ""
  exit 0
fi

# 4. Fast-forward only (jamais reset --hard ; une divergence = réconciliation manuelle).
git merge --ff-only origin/main || abort "non fast-forwardable (lignée divergente) — réconcilier main à la main"
log "synced $local_sha → $remote_sha"

# 5. Garde parité Node (.nvmrc) — alerte seulement (upgrade = manuel via NodeSource).
want_major=$(tr -d 'v' < .nvmrc 2>/dev/null | cut -d. -f1)
have_major=$(node -v 2>/dev/null | tr -d 'v' | cut -d. -f1)
if [ -n "$want_major" ] && [ -n "$have_major" ] && [ "$want_major" != "$have_major" ]; then
  alert "dérive Node : v$have_major installé, .nvmrc=$want_major attendu — l'app peut crasher ; upgrade manuel requis (NodeSource setup_${want_major}.x)"
fi

# 6. npm install seulement si le lockfile a changé, puis build.
if ! git diff --quiet "$local_sha" "$remote_sha" -- package-lock.json 2>/dev/null; then
  log "package-lock.json modifié → npm install"
  npm install >/dev/null 2>&1 || abort "npm install échoué"
fi
npm run build >/dev/null 2>&1 || abort "npm run build échoué (probable régression code ou parité deps)"

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
