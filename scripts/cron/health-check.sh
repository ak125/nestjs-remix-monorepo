#!/usr/bin/env bash
# ==============================================================================
# Health Check L0 — Lightweight wrapper
# Extracted from: scripts/runbook-content-refresh-e2e.sh (section L0)
#
# Checks: API health, Redis, BullMQ failed jobs, RAG (informational)
# Runs: every 5 minutes via cron
#
# Env:
#   BASE               — API base URL (default: http://localhost:3000)
#   REDIS_CONTAINER    — Redis container name (default: app-redis_prod-1)
#   ALERT_WEBHOOK_URL  — Optional webhook for alerts (Slack/Discord/ntfy)
# ==============================================================================
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
REDIS_CONTAINER="${REDIS_CONTAINER:-app-redis_prod-1}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
FAILURES=0

log() { echo "[$TIMESTAMP] $1"; }

# L0.1 — API health
HEALTH_STATUS=$(curl -sf --max-time 5 "${BASE}/health" \
  | jq -r '.status // "unknown"' 2>/dev/null || echo "unreachable")
if [ "$HEALTH_STATUS" = "ok" ]; then
  log "L0.1 API: OK"
else
  log "L0.1 API: FAIL (status=${HEALTH_STATUS})"
  FAILURES=$((FAILURES + 1))
fi

# L0.2 — Redis ping
REDIS_PING=$(docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null || echo "FAIL")
if [ "$REDIS_PING" = "PONG" ]; then
  log "L0.2 Redis: OK"
else
  log "L0.2 Redis: FAIL"
  FAILURES=$((FAILURES + 1))
fi

# L0.3 — BullMQ failed jobs (threshold: >10)
BQ_FAILED=$(docker exec "$REDIS_CONTAINER" redis-cli ZCARD \
  "bull:seo-monitor:failed" 2>/dev/null || echo "0")
BQ_ACTIVE=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN \
  "bull:seo-monitor:active" 2>/dev/null || echo "0")
log "L0.3 BullMQ: active=${BQ_ACTIVE} failed=${BQ_FAILED}"
if [ "${BQ_FAILED:-0}" -gt 10 ]; then
  log "L0.3 BullMQ: WARN (failed=${BQ_FAILED} > 10)"
  FAILURES=$((FAILURES + 1))
fi

# L0.4 — RAG health (overlay, informational only)
RAG_STATUS=$(curl -sf --max-time 5 "${BASE}/api/rag/health" \
  | jq -r '.status // "unreachable"' 2>/dev/null || echo "unreachable")
log "L0.4 RAG: ${RAG_STATUS} (overlay — informational)"

# Summary + optional webhook alert
if [ $FAILURES -gt 0 ]; then
  log "RESULT: ${FAILURES} failure(s) detected"
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -sf --max-time 5 -X POST "${ALERT_WEBHOOK_URL}" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"[AutoMecanik] Health check: ${FAILURES} failure(s) at ${TIMESTAMP}\"}" \
      >/dev/null 2>&1 || true
  fi
  exit 1
fi

log "RESULT: All checks passed"
exit 0
