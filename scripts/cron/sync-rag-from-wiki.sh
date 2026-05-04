#!/usr/bin/env bash
# ==============================================================================
# sync-rag-from-wiki.sh — Mirror automecanik-wiki/exports/rag/ → automecanik-rag/knowledge/
#
# ADR-031 §D20/D22 : automecanik-rag/knowledge/ est un répertoire **généré**
# (mirror read-only) dont la source autoritaire est automecanik-wiki/exports/rag/.
# Ce cron exécute la chaîne canon en local sur DEV VPS :
#
#   1. git pull wiki (récupère contenu généré upstream)
#   2. git pull rag (sync HEAD courant)
#   3. sync-wiki-exports-to-rag.py --apply (D20 enforce + sha256 idempotent)
#   4. git commit + push avec marker `synced-from-wiki: <wiki-sha>` (D22)
#
# Pourquoi cron VPS et pas GitHub Actions :
#   - Les 3 clones git sont déjà locaux (zéro re-checkout)
#   - Deploy bot SSH key déjà configurée (zéro PAT à rotater)
#   - Pas de rate limit Wikidata/Wikipedia (zéro réseau hosted)
#   - Cohérent avec le pattern existant (qa-audit-cron.sh, run-phase-f.sh)
#
# Cron cadence : hourly. Le sync est idempotent (sha256 check) donc no-op si
# rien n'a changé.
#
# Logs : /opt/automecanik/rag/logs/sync-rag-from-wiki.log (mkdir -p si absent).
#
# Env (optionnels, defaults sains pour DEV VPS) :
#   AUTOMECANIK_WIKI_PATH (default /opt/automecanik/automecanik-wiki)
#   AUTOMECANIK_RAG_PATH  (default /opt/automecanik/rag)
#   APP_PATH              (default /opt/automecanik/app)
# ==============================================================================
set -euo pipefail

WIKI_PATH="${AUTOMECANIK_WIKI_PATH:-/opt/automecanik/automecanik-wiki}"
RAG_PATH="${AUTOMECANIK_RAG_PATH:-/opt/automecanik/rag}"
APP_PATH="${APP_PATH:-/opt/automecanik/app}"
SYNC_SCRIPT="$APP_PATH/scripts/rag-sync/sync-wiki-exports-to-rag.py"
LOG_DIR="/opt/automecanik/rag/logs"
LOG_FILE="$LOG_DIR/sync-rag-from-wiki.log"

mkdir -p "$LOG_DIR"
ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }
log() { echo "[$(ts)] $*" | tee -a "$LOG_FILE"; }

log "=== sync-rag-from-wiki start ==="

# --- Sanity checks ---
for d in "$WIKI_PATH" "$RAG_PATH" "$APP_PATH"; do
  [ -d "$d/.git" ] || { log "ERROR: $d not a git repo"; exit 2; }
done
[ -x "$SYNC_SCRIPT" ] || [ -r "$SYNC_SCRIPT" ] || {
  log "ERROR: sync script not found: $SYNC_SCRIPT"; exit 2;
}

# --- Global lock to avoid overlap with other rag operations ---
GLOBAL_LOCK="/tmp/rag-global.lock"
exec 8>"$GLOBAL_LOCK"
if ! flock -n 8; then
  log "Another RAG operation active, skipping this run"
  exit 0
fi

# --- Step 1: Pull wiki main (source of truth) ---
log "[1/4] git pull wiki main"
cd "$WIKI_PATH"
WIKI_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")
if [ "$WIKI_BRANCH" != "main" ]; then
  log "WARN: wiki not on main (branch=$WIKI_BRANCH), skipping pull"
else
  git pull --ff-only origin main 2>&1 | tee -a "$LOG_FILE"
fi
WIKI_SHA=$(git rev-parse --short HEAD)
log "  wiki HEAD: $WIKI_SHA"

# --- Step 2: Pull rag main (target) ---
log "[2/4] git pull rag main"
cd "$RAG_PATH"
RAG_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")
if [ "$RAG_BRANCH" != "main" ]; then
  log "ERROR: rag not on main (branch=$RAG_BRANCH), aborting (manual cleanup needed)"
  exit 3
fi
git pull --ff-only origin main 2>&1 | tee -a "$LOG_FILE"

# --- Step 3: Run sync (D20 enforce + sha256 idempotent) ---
log "[3/4] sync-wiki-exports-to-rag.py --apply"
python3 "$SYNC_SCRIPT" \
  --wiki-repo "$WIKI_PATH" \
  --rag-repo "$RAG_PATH" \
  --apply 2>&1 | tee -a "$LOG_FILE"

# --- Step 4: Commit + push if changes ---
cd "$RAG_PATH"
if git diff --quiet -- knowledge/ && git diff --cached --quiet -- knowledge/; then
  log "[4/4] No changes under knowledge/ — nothing to commit (idempotent)"
  log "=== sync-rag-from-wiki done (no-op) ==="
  exit 0
fi

log "[4/4] Committing + pushing changes"
git add knowledge/

# D22 marker : marker `synced-from-wiki: <sha>` requis par .githooks/commit-msg
# et .github/workflows/d22-protected-paths.yml côté rag.
COMMIT_MSG="synced-from-wiki: $WIKI_SHA

Source: automecanik-wiki@$WIKI_SHA
Sync: scripts/rag-sync/sync-wiki-exports-to-rag.py via cron VPS DEV.
Pattern canon ADR-031 §D20/D22 — aucune écriture humaine directe."

git commit -m "$COMMIT_MSG" 2>&1 | tee -a "$LOG_FILE"
git push origin main 2>&1 | tee -a "$LOG_FILE"

log "=== sync-rag-from-wiki done (synced @ $WIKI_SHA) ==="
