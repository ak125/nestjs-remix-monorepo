#!/usr/bin/env bash
# ==============================================================================
# deploy-phase1.sh — Install crontab entries for AutoMecanik VPS
#
# Installs 7 cron jobs that orchestrate EXISTING scripts:
#   1. Health check (every 5min)      — scripts/cron/health-check.sh
#   2. SEO monitor (every 30min)      — scripts/monitor-pages-no-results.sh
#   3. Log cleanup (daily 2am)        — scripts/cleanup-old-logs.sh
#   4. Disk alert (daily 2:05am)      — scripts/cron/disk-alert.sh
#   5. Vehicle images (Sun 4am)       — scripts/check-missing-vehicle-images.ts
#   6. Marketing plan (Mon 6am)       — scripts/marketing/generate-weekly-plan.ts
#   7. Marketing copy dry-run (Tue 6am) — scripts/marketing/generate-copy-batch.ts
#
# Usage:
#   bash scripts/deploy-phase1.sh            # Install everything
#   bash scripts/deploy-phase1.sh --dry-run  # Preview without changes
#
# Idempotent. Preserves existing crontab entries.
# ==============================================================================
set -euo pipefail

APP_DIR="/opt/automecanik/app"
LOG_DIR="/var/log/automecanik"
CRON_DIR="${APP_DIR}/scripts/cron"
TS_NODE="${APP_DIR}/node_modules/.bin/ts-node"
ENV_BACKEND="${APP_DIR}/backend/.env"
ENV_VECTOR="${APP_DIR}/config/vector/.env.vector"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# Colors (interactive only)
if [ -t 1 ]; then
  G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'
else
  G=''; Y=''; R=''; N=''
fi
ok()   { echo -e "  ${G}[OK]${N}   $1"; }
skip() { echo -e "  ${Y}[SKIP]${N} $1"; }
dry()  { echo -e "  ${Y}[DRY]${N}  $1"; }
fail() { echo -e "  ${R}[ERR]${N}  $1"; }

echo ""
echo "============================================================"
echo " deploy-phase1.sh — Crontab Orchestration"
echo " Mode: $([ "$DRY_RUN" = true ] && echo 'DRY-RUN (no changes)' || echo 'LIVE')"
echo " Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""

# ==============================================================================
# Phase 0: Prerequisites
# ==============================================================================

echo "--- Phase 0: Prerequisites ---"
echo ""

PREREQ_OK=true

for cmd in curl jq docker npx; do
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "$cmd found"
  else
    fail "$cmd missing"; PREREQ_OK=false
  fi
done

if [ -f "$ENV_BACKEND" ]; then
  ok "backend/.env found ($(grep -c '=' "$ENV_BACKEND") vars)"
else
  fail "backend/.env missing at $ENV_BACKEND"; PREREQ_OK=false
fi

if [ -f "$TS_NODE" ]; then
  ok "ts-node found"
else
  fail "ts-node missing at $TS_NODE"; PREREQ_OK=false
fi

if [ -f "$ENV_VECTOR" ]; then
  ok ".env.vector found"
else
  skip ".env.vector not found — log cleanup will be skipped by cron"
fi

SCRIPTS=(
  "scripts/cron/health-check.sh"
  "scripts/cron/disk-alert.sh"
  "scripts/monitor-pages-no-results.sh"
  "scripts/cleanup-old-logs.sh"
  "scripts/check-missing-vehicle-images.ts"
  "scripts/marketing/generate-weekly-plan.ts"
  "scripts/marketing/generate-copy-batch.ts"
)

for s in "${SCRIPTS[@]}"; do
  if [ -f "${APP_DIR}/${s}" ]; then
    ok "$s"
  else
    fail "$s missing"; PREREQ_OK=false
  fi
done

if [ "$PREREQ_OK" = false ]; then
  echo ""
  fail "Prerequisites check failed. Fix the issues above and retry."
  exit 1
fi

echo ""
ok "All prerequisites passed"

# ==============================================================================
# Phase 1: Setup directories + permissions
# ==============================================================================

echo ""
echo "--- Phase 1: Setup ---"
echo ""

# Log directory
if [ ! -d "$LOG_DIR" ]; then
  if [ "$DRY_RUN" = true ]; then
    dry "Would create $LOG_DIR"
  else
    mkdir -p "$LOG_DIR"
    ok "Created $LOG_DIR"
  fi
else
  ok "$LOG_DIR exists"
fi

# Ensure scripts are executable
if [ "$DRY_RUN" = true ]; then
  dry "Would chmod +x on cron wrappers and shell scripts"
else
  chmod +x "${CRON_DIR}/health-check.sh"
  chmod +x "${CRON_DIR}/disk-alert.sh"
  chmod +x "${APP_DIR}/scripts/monitor-pages-no-results.sh"
  chmod +x "${APP_DIR}/scripts/cleanup-old-logs.sh"
  chmod +x "${APP_DIR}/scripts/runbook-content-refresh-e2e.sh"
  ok "Scripts marked executable"
fi

# ==============================================================================
# Phase 2: Crontab entries (idempotent)
# ==============================================================================

echo ""
echo "--- Phase 2: Crontab entries ---"
echo ""

CURRENT=$(crontab -l 2>/dev/null || echo "")
ADDED=0
SKIPPED=0

# Helper: add a cron entry if marker string not already present
add_cron() {
  local marker="$1" entry="$2" label="$3"
  if echo "$CURRENT" | grep -qF "$marker"; then
    skip "Already installed: ${label}"
    SKIPPED=$((SKIPPED + 1))
  elif [ "$DRY_RUN" = true ]; then
    dry "Would add: ${label}"
    echo "      ${entry}"
    ADDED=$((ADDED + 1))
  else
    CURRENT="${CURRENT}
${entry}"
    ADDED=$((ADDED + 1))
    ok "Added: ${label}"
  fi
}

# Shorthand for env sourcing in cron entries
SRC_BE=". ${ENV_BACKEND} 2>/dev/null"
SRC_VEC="test -f ${ENV_VECTOR} && . ${ENV_VECTOR}"

# --- Entry 1: Health check (every 5 min) ---
add_cron "cron/health-check.sh" \
  "*/5 * * * * /usr/bin/bash ${CRON_DIR}/health-check.sh >> ${LOG_DIR}/health-check.log 2>&1" \
  "1/7 Health check (*/5min)"

# --- Entry 2: SEO monitor (every 30 min) ---
add_cron "monitor-pages-no-results.sh" \
  "*/30 * * * * cd ${APP_DIR} && API_BASE_URL=http://localhost:3000 /usr/bin/bash scripts/monitor-pages-no-results.sh >> ${LOG_DIR}/seo-monitor.log 2>&1" \
  "2/7 SEO monitor (*/30min)"

# --- Entry 3: Log cleanup (daily 2am) ---
add_cron "cleanup-old-logs.sh" \
  "0 2 * * * cd ${APP_DIR} && ${SRC_VEC} && /usr/bin/bash scripts/cleanup-old-logs.sh 90 >> ${LOG_DIR}/log-cleanup.log 2>&1" \
  "3/7 Log cleanup (daily 2:00)"

# --- Entry 4: Disk alert (daily 2:05am) ---
add_cron "cron/disk-alert.sh" \
  "5 2 * * * /usr/bin/bash ${CRON_DIR}/disk-alert.sh >> ${LOG_DIR}/disk-alert.log 2>&1" \
  "4/7 Disk alert (daily 2:05)"

# --- Entry 5: Vehicle images (Sunday 4am) ---
add_cron "check-missing-vehicle-images.ts" \
  "0 4 * * 0 cd ${APP_DIR} && ${SRC_BE} && ${TS_NODE} -P backend/tsconfig.json scripts/check-missing-vehicle-images.ts >> ${LOG_DIR}/vehicle-images.log 2>&1" \
  "5/7 Vehicle images (Sun 4:00)"

# --- Entry 6: Marketing weekly plan (Monday 6am) ---
add_cron "generate-weekly-plan.ts" \
  "0 6 * * 1 cd ${APP_DIR} && ${SRC_BE} && ${TS_NODE} -P backend/tsconfig.json scripts/marketing/generate-weekly-plan.ts --week \$(date +\\%Y-W\\%V) >> ${LOG_DIR}/marketing-plan.log 2>&1" \
  "6/7 Marketing plan (Mon 6:00)"

# --- Entry 7: Marketing copy batch dry-run (Tuesday 6am) ---
add_cron "generate-copy-batch.ts" \
  "0 6 * * 2 cd ${APP_DIR} && ${SRC_BE} && ${TS_NODE} -P backend/tsconfig.json scripts/marketing/generate-copy-batch.ts --week \$(date +\\%Y-W\\%V) --dry-run >> ${LOG_DIR}/marketing-copy.log 2>&1" \
  "7/7 Marketing copy dry-run (Tue 6:00)"

# Apply crontab
echo ""
if [ "$DRY_RUN" = false ] && [ $ADDED -gt 0 ]; then
  echo "$CURRENT" | crontab -
  ok "Crontab updated (${ADDED} added, ${SKIPPED} already present)"
elif [ "$DRY_RUN" = false ]; then
  ok "No new entries needed (${SKIPPED} already present)"
else
  dry "Would install ${ADDED} new entries (${SKIPPED} already present)"
fi

# ==============================================================================
# Phase 3: Verification
# ==============================================================================

echo ""
echo "--- Phase 3: Verification ---"
echo ""

if [ "$DRY_RUN" = true ]; then
  EXISTING=$(echo "$CURRENT" | grep -c '[^[:space:]]' || echo 0)
  dry "Current entries: ${EXISTING}, would add: ${ADDED}, projected total: $((EXISTING + ADDED))"
else
  FINAL_COUNT=$(crontab -l 2>/dev/null | grep -v '^#' | grep -v '^$' | wc -l)
  ok "Total crontab entries: ${FINAL_COUNT}"
  echo ""
  echo "  Current crontab:"
  echo "  ────────────────"
  crontab -l 2>/dev/null | grep -v '^$' | while IFS= read -r line; do
    echo "  $line"
  done
fi

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo "============================================================"
echo " Summary"
echo "============================================================"
echo ""
echo "  Entries added:   ${ADDED}"
echo "  Already present: ${SKIPPED}"
echo "  Logs directory:  ${LOG_DIR}/"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "  This was a DRY-RUN. No changes were made."
  echo "  Run without --dry-run to apply."
else
  echo "  Next steps:"
  echo "    1. Verify: crontab -l"
  echo "    2. Test health check: bash ${CRON_DIR}/health-check.sh"
  echo "    3. Test disk alert:   bash ${CRON_DIR}/disk-alert.sh"
  echo "    4. Check logs after 5min: tail ${LOG_DIR}/health-check.log"
  echo ""
  echo "  Optional: set ALERT_WEBHOOK_URL in crontab for alerts:"
  echo "    crontab -e  # add at top: ALERT_WEBHOOK_URL=https://hooks.slack.com/..."
fi

echo ""
echo "  Done."
echo ""
