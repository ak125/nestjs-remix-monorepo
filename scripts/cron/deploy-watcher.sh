#!/usr/bin/env bash
# ==============================================================================
# Deploy Watcher — Post-deploy health verification
#
# Waits for container startup, then polls /health every 10s for 2 min max.
# Reports success/failure to Supabase __cron_runs.
#
# Usage: Called as post-deploy step in .github/workflows/ci.yml
# NOT a cron job — runs once per deployment.
#
# Env:
#   DEPLOY_URL         — Health check URL (default: http://localhost:3000)
#   APP_CONTAINER      — Container name (default: nestjs-remix-monorepo-prod)
#   ALERT_WEBHOOK_URL  — Optional Slack webhook for deploy failures
# ==============================================================================
set -euo pipefail

# Supabase report helper
source "$(dirname "$0")/lib-supabase-report.sh" 2>/dev/null || true
_DW_START=$(date +%s)

DEPLOY_URL="${DEPLOY_URL:-http://localhost:3000}"
APP_CONTAINER="${APP_CONTAINER:-nestjs-remix-monorepo-prod}"
STARTUP_WAIT="${STARTUP_WAIT:-30}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-12}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[$TIMESTAMP] deploy-watcher: $1"; }

# Step 1: Wait for container startup
log "Waiting ${STARTUP_WAIT}s for container startup..."
sleep "$STARTUP_WAIT"

# Step 2: Verify container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${APP_CONTAINER}$"; then
  log "FAIL: Container ${APP_CONTAINER} not running after deploy"
  _DW_END=$(date +%s)
  _DW_DUR=$((_DW_END - _DW_START))
  cron_report "deploy-watcher" "error" "$_DW_DUR" \
    '{"deploy_success":false,"container_running":false,"attempts":0}' \
    "container not running"

  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -sf --max-time 5 -X POST "${ALERT_WEBHOOK_URL}" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"[AutoMecanik] DEPLOY FAILED: container ${APP_CONTAINER} not running at ${TIMESTAMP}\"}" \
      >/dev/null 2>&1 || true
  fi
  exit 1
fi

# Step 3: Poll /health until OK or timeout
ATTEMPT=0
HEALTHY=false
LAST_STATUS="unknown"

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  LAST_STATUS=$(curl -sf --max-time 5 "${DEPLOY_URL}/health" \
    | jq -r '.status // "unknown"' 2>/dev/null || echo "unreachable")

  if [ "$LAST_STATUS" = "ok" ]; then
    HEALTHY=true
    log "OK: Health check passed on attempt ${ATTEMPT}/${MAX_ATTEMPTS}"
    break
  fi

  log "Attempt ${ATTEMPT}/${MAX_ATTEMPTS}: status=${LAST_STATUS}, retrying in ${POLL_INTERVAL}s..."
  sleep "$POLL_INTERVAL"
done

# Step 4: Report result
_DW_END=$(date +%s)
_DW_DUR=$((_DW_END - _DW_START))

if [ "$HEALTHY" = true ]; then
  log "DEPLOY OK: Healthy after ${ATTEMPT} attempts (${_DW_DUR}s total)"
  cron_report "deploy-watcher" "ok" "$_DW_DUR" \
    "{\"deploy_success\":true,\"container_running\":true,\"attempts\":${ATTEMPT},\"startup_s\":${_DW_DUR}}" \
    "OK after ${ATTEMPT} attempts ${_DW_DUR}s"
  exit 0
else
  log "DEPLOY FAIL: Not healthy after ${MAX_ATTEMPTS} attempts (last: ${LAST_STATUS})"
  cron_report "deploy-watcher" "error" "$_DW_DUR" \
    "{\"deploy_success\":false,\"container_running\":true,\"attempts\":${ATTEMPT},\"last_status\":\"${LAST_STATUS}\"}" \
    "FAIL after ${ATTEMPT} attempts last=${LAST_STATUS}"

  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -sf --max-time 5 -X POST "${ALERT_WEBHOOK_URL}" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"[AutoMecanik] DEPLOY FAILED: /health not OK after ${MAX_ATTEMPTS} attempts (${LAST_STATUS}) at ${TIMESTAMP}\"}" \
      >/dev/null 2>&1 || true
  fi
  exit 1
fi
