#!/usr/bin/env bash
# ==============================================================================
# Queue Health Monitor — BullMQ queue depth & failed jobs
#
# Checks all BullMQ queues for: waiting, active, failed, delayed counts.
# Alerts on: failed > 10, waiting > 100, active > 20 (stuck workers).
# Runs: every 15 minutes via Supercronic
#
# Env:
#   REDIS_CONTAINER — Redis container name (default: redis_prod)
# ==============================================================================
set -euo pipefail

# Supabase report helper
source "$(dirname "$0")/lib-supabase-report.sh" 2>/dev/null || true
_QH_START=$(date +%s)

REDIS_CONTAINER="${REDIS_CONTAINER:-redis_prod}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
QUEUES="seo-monitor content-refresh seo-audit video-render"

STATUS="ok"
TOTAL_FAILED=0
TOTAL_WAITING=0
METRICS_PARTS=""

log() { echo "[$TIMESTAMP] $1"; }

redis_cmd() {
  docker exec "$REDIS_CONTAINER" redis-cli "$@" 2>/dev/null || echo "0"
}

for Q in $QUEUES; do
  WAITING=$(redis_cmd LLEN "bull:${Q}:wait")
  ACTIVE=$(redis_cmd LLEN "bull:${Q}:active")
  FAILED=$(redis_cmd ZCARD "bull:${Q}:failed")
  DELAYED=$(redis_cmd ZCARD "bull:${Q}:delayed")

  log "Queue ${Q}: waiting=${WAITING} active=${ACTIVE} failed=${FAILED} delayed=${DELAYED}"

  TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
  TOTAL_WAITING=$((TOTAL_WAITING + WAITING))

  if [ "$FAILED" -gt 10 ]; then
    log "ALERT: ${Q} has ${FAILED} failed jobs (>10)"
    STATUS="error"
  fi
  if [ "$WAITING" -gt 100 ]; then
    log "WARN: ${Q} has ${WAITING} waiting jobs (>100)"
    [ "$STATUS" = "ok" ] && STATUS="warn"
  fi
  if [ "$ACTIVE" -gt 20 ]; then
    log "WARN: ${Q} has ${ACTIVE} active jobs (>20, stuck workers?)"
    [ "$STATUS" = "ok" ] && STATUS="warn"
  fi

  # Build per-queue JSON fragment
  METRICS_PARTS="${METRICS_PARTS}\"${Q}\":{\"w\":${WAITING},\"a\":${ACTIVE},\"f\":${FAILED},\"d\":${DELAYED}},"
done

log "TOTAL: failed=${TOTAL_FAILED} waiting=${TOTAL_WAITING} status=${STATUS}"

# Report to Supabase
_QH_END=$(date +%s)
_QH_DUR=$((_QH_END - _QH_START))
cron_report "queue-health" "$STATUS" "$_QH_DUR" \
  "{\"queues\":{${METRICS_PARTS%,}},\"total_failed\":${TOTAL_FAILED},\"total_waiting\":${TOTAL_WAITING}}" \
  "F=${TOTAL_FAILED} W=${TOTAL_WAITING} status=${STATUS}"

exit 0
