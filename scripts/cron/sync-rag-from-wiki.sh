#!/usr/bin/env bash
# ==============================================================================
# sync-rag-from-wiki.sh — Mirror automecanik-wiki/exports/rag/ → automecanik-rag/knowledge/
#
# ADR-031 §D20/D22 : automecanik-rag/knowledge/ est un répertoire **généré**
# (mirror read-only) dont la source autoritaire est automecanik-wiki/exports/rag/.
# Ce cron exécute la chaîne canon en local sur DEV VPS :
#
#   1. git fetch wiki main + instantané de exports/rag à origin/main
#   2. git pull rag (sync HEAD courant)
#   3. sync-wiki-exports-to-rag.py --apply (D20 enforce + sha256 idempotent,
#      baseline héritée audit/baselines/rag-mirror-legacy-baseline.json)
#   4. git commit + push avec marker `synced-from-wiki: <wiki-sha>` (D22)
#
# Le clone wiki est partagé (branches humaines et agents, worktrees) : le cron
# ne fait que `fetch`, sans jamais changer sa branche ni ses fichiers. Lire son
# arbre de travail a alimenté le miroir hors main (branche feat/ depuis 2026-07-26).
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
# Observabilité : chaque passage enregistre son issue via cron_report
# (scripts/cron/lib-supabase-report.sh), lue par le hook SessionStart : error si
# une étape échoue (dont un fichier du miroir absent des exports et de la baseline
# héritée), warn si des entrées de la baseline ne sont plus hors exports (baseline
# à resserrer), ok sinon. Le résumé donne le compte des fichiers hérités préservés.
# Sans ce rapport, le refus horaire du 2026-09-29 au 2026-10-24 (miroir non
# rafraîchi) n'a été vu que dans ce log.
#
# Env (optionnels, defaults sains pour DEV VPS) :
#   AUTOMECANIK_WIKI_PATH (default /opt/automecanik/automecanik-wiki)
#   AUTOMECANIK_RAG_PATH  (default /opt/automecanik/rag)
#   APP_PATH              (default /opt/automecanik/app)
#   SYNC_RAG_LOG_DIR      (default /opt/automecanik/rag/logs)
#   RAG_GLOBAL_LOCK       (default /tmp/rag-global.lock)
#   CRON_REPORT_MAX_AGE_S silence au-delà duquel le hook SessionStart signale le cron arrêté (défaut : 10800)
# ==============================================================================
set -euo pipefail

WIKI_PATH="${AUTOMECANIK_WIKI_PATH:-/opt/automecanik/automecanik-wiki}"
RAG_PATH="${AUTOMECANIK_RAG_PATH:-/opt/automecanik/rag}"
APP_PATH="${APP_PATH:-/opt/automecanik/app}"
SYNC_SCRIPT="$APP_PATH/scripts/rag-sync/sync-wiki-exports-to-rag.py"
LOG_DIR="${SYNC_RAG_LOG_DIR:-/opt/automecanik/rag/logs}"
LOG_FILE="$LOG_DIR/sync-rag-from-wiki.log"

LOG_TAG=sync-rag-from-wiki
START="$(date +%s)"
# Cadence horaire : trois passages manqués = cron considéré arrêté.
CRON_REPORT_MAX_AGE_S="${CRON_REPORT_MAX_AGE_S:-10800}"
# shellcheck source=lib-supabase-report.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-supabase-report.sh" 2>/dev/null || true
STEP=start
OUTCOME=""
WARNING=""
WIKI_SNAPSHOT=""
report_outcome() {
  local rc=$? status=ok summary
  if [ -n "$WIKI_SNAPSHOT" ]; then rm -rf -- "$WIKI_SNAPSHOT"; fi
  if [ "$rc" -ne 0 ]; then
    status=error
    summary="échec à l'étape ${STEP} (code ${rc}), voir ${LOG_FILE}"
  elif [ -n "$WARNING" ]; then
    status=warn
    summary="${OUTCOME} ; ${WARNING}"
  else
    summary="$OUTCOME"
  fi
  if command -v cron_report >/dev/null 2>&1; then
    cron_report "$LOG_TAG" "$status" "$(( $(date +%s) - START ))" '' "$summary"
  else
    echo "WARN: cron_report indisponible (lib-supabase-report.sh non chargée) — issue du run NON enregistrée" >&2
  fi
}
trap report_outcome EXIT

mkdir -p "$LOG_DIR"
ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }
log() { echo "[$(ts)] $*" | tee -a "$LOG_FILE"; }

log "=== sync-rag-from-wiki start ==="

# --- Sanity checks ---
STEP=sanity
for d in "$WIKI_PATH" "$RAG_PATH" "$APP_PATH"; do
  [ -d "$d/.git" ] || { log "ERROR: $d not a git repo"; exit 2; }
done
[ -x "$SYNC_SCRIPT" ] || [ -r "$SYNC_SCRIPT" ] || {
  log "ERROR: sync script not found: $SYNC_SCRIPT"; exit 2;
}

# --- Global lock to avoid overlap with other rag operations ---
# Partagé avec scripts/reindex_two_pass_cron.sh ; surchargé par le test seulement.
GLOBAL_LOCK="${RAG_GLOBAL_LOCK:-/tmp/rag-global.lock}"
exec 8>"$GLOBAL_LOCK"
if ! flock -n 8; then
  log "Another RAG operation active, skipping this run"
  OUTCOME="passage sauté : autre opération RAG en cours"
  exit 0
fi

# --- Step 1: Snapshot wiki exports at origin/main (source of truth) ---
STEP="[1/4] fetch wiki"
log "[1/4] git fetch wiki main, snapshot exports/rag"
git -C "$WIKI_PATH" fetch -q origin +refs/heads/main:refs/remotes/origin/main 2>&1 | tee -a "$LOG_FILE"
WIKI_COMMIT=$(git -C "$WIKI_PATH" rev-parse --verify 'refs/remotes/origin/main^{commit}')
WIKI_SHA=$(git -C "$WIKI_PATH" rev-parse --short "$WIKI_COMMIT")
WIKI_SNAPSHOT=$(mktemp -d "${TMPDIR:-/tmp}/sync-rag-wiki.XXXXXX")
git -C "$WIKI_PATH" archive --format=tar "$WIKI_COMMIT" -- exports/rag | tar -x -C "$WIKI_SNAPSHOT"
log "  wiki origin/main: $WIKI_SHA"

# --- Step 2: Pull rag main (target) ---
STEP="[2/4] pull rag"
log "[2/4] git pull rag main"
cd "$RAG_PATH"
RAG_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")
if [ "$RAG_BRANCH" != "main" ]; then
  log "ERROR: rag not on main (branch=$RAG_BRANCH), aborting (manual cleanup needed)"
  exit 3
fi
# Transition safety: Step 4 intentionally never commits knowledge/.last-sync.json,
# so the sync script's per-run rewrite leaves it a dirty TRACKED file until the
# companion rag-repo untrack lands. A dirty tracked file blocks `git pull --ff-only`
# the moment an incoming commit touches it (notably the untrack commit's deletion),
# which would wedge this cron every hour under `set -euo pipefail`. Discard our
# local manifest churn first — it is regenerated from scratch in Step 3, so this is
# always safe. No-op once the manifest is untracked/ignored (post-untrack).
git checkout -- knowledge/.last-sync.json 2>/dev/null || true
git pull --ff-only origin main 2>&1 | tee -a "$LOG_FILE"

# --- Step 3: Run sync (D20 enforce + sha256 idempotent) ---
STEP="[3/4] sync"
log "[3/4] sync-wiki-exports-to-rag.py --apply"
python3 "$SYNC_SCRIPT" \
  --wiki-repo "$WIKI_SNAPSHOT" \
  --rag-repo "$RAG_PATH" \
  --source-ref "automecanik-wiki@$WIKI_COMMIT" \
  --apply 2>&1 | tee -a "$LOG_FILE"
# Compte hérité lu dans le manifeste que le sync vient d'écrire.
LEGACY_COUNTS=$(python3 -c \
  'import json, sys; m = json.load(open(sys.argv[1]))["legacy_unreconciled"]; print(m["count"], m["baseline_total"])' \
  "$RAG_PATH/knowledge/.last-sync.json")
read -r LEGACY_COUNT LEGACY_TOTAL <<<"$LEGACY_COUNTS"
LEGACY="hérités hors exports : $LEGACY_COUNT (baseline $LEGACY_TOTAL)"
if [ "$LEGACY_COUNT" -lt "$LEGACY_TOTAL" ]; then
  WARNING="baseline héritée à resserrer : $(( LEGACY_TOTAL - LEGACY_COUNT )) entrée(s) obsolète(s)"
fi

# --- Step 4: Commit + push only if real CONTENT changed ---
# knowledge/.last-sync.json is a per-run runtime freshness manifest: the sync
# script rewrites it every run with a fresh `synced_at` (+ stats), and it is
# read *from disk* by RagMirrorFreshnessService for the 36h mirror-freshness
# SLO. It is runtime observability state, NOT git-tracked source content —
# committing it turned every hourly no-op sync into a `synced-from-wiki:` churn
# commit (defeating the idempotency intent of this step). It is kept out of the
# index so a run that copies 0 new files produces NO commit. The rag repo also
# ignores it (#19); the reset below keeps the job correct if that is reverted.
STEP="[4/4] commit"
cd "$RAG_PATH"
MANIFEST=knowledge/.last-sync.json
# Stage first, THEN inspect the index. A plain `git diff` guard is blind to
# UNTRACKED files and would silently drop a pure-addition sync (a brand-new
# knowledge file) — the mirror's primary payload. Staging surfaces additions,
# modifications and deletions in one shot; the reset keeps the runtime manifest
# churn out of the commit. Naming the manifest in an `:(exclude)` pathspec made
# `git add` exit 1 once the rag repo ignored it (#19, 2026-07-20): every run then
# stopped here, unseen, as git's message never reached this log.
git add -A -- knowledge/ 2>&1 | tee -a "$LOG_FILE"
git reset -q -- "$MANIFEST" 2>&1 | tee -a "$LOG_FILE"
if git diff --cached --quiet -- knowledge/; then
  log "[4/4] No content changes under knowledge/ (runtime manifest churn ignored) — nothing to commit (idempotent)"
  log "=== sync-rag-from-wiki done (no-op) ==="
  OUTCOME="aucun changement (wiki @ $WIKI_SHA) ; $LEGACY"
  exit 0
fi

log "[4/4] Committing + pushing content changes"

# D22 marker : marker `synced-from-wiki: <sha>` requis par .githooks/commit-msg
# et .github/workflows/d22-protected-paths.yml côté rag.
COMMIT_MSG="synced-from-wiki: $WIKI_SHA

Source: automecanik-wiki@$WIKI_SHA
Sync: scripts/rag-sync/sync-wiki-exports-to-rag.py via cron VPS DEV.
Pattern canon ADR-031 §D20/D22 — aucune écriture humaine directe."

git commit -m "$COMMIT_MSG" 2>&1 | tee -a "$LOG_FILE"
git push origin main 2>&1 | tee -a "$LOG_FILE"

log "=== sync-rag-from-wiki done (synced @ $WIKI_SHA) ==="
OUTCOME="miroir synchronisé @ $WIKI_SHA ; $LEGACY"
