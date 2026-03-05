#!/usr/bin/env bash
# ==============================================================================
# Health Check L0 — Lightweight wrapper
# Extracted from: scripts/runbook-content-refresh-e2e.sh (section L0)
#
# Checks: API health, Redis, BullMQ failed jobs, RAG, performance
# Runs: every 5 minutes via cron
#
# Env:
#   BASE               — API base URL (default: http://localhost:3000)
#   REDIS_CONTAINER    — Redis container name (default: app-redis_prod-1)
#   ALERT_WEBHOOK_URL  — Optional webhook for alerts (Slack/Discord/ntfy)
# ==============================================================================
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
REDIS_CONTAINER="${REDIS_CONTAINER:-redis_prod}"
APP_CONTAINER="${APP_CONTAINER:-nestjs-remix-monorepo-prod}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
FAILURES=0
WARNINGS=0

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

# L0.2b — Redis crash-loop detection
REDIS_STATUS=$(docker ps --format "{{.Names}} {{.Status}}" | grep "$REDIS_CONTAINER" | head -1)
if echo "$REDIS_STATUS" | grep -q "Restarting"; then
  log "L0.2b Redis: CRASH-LOOP detected (${REDIS_STATUS})"
  FAILURES=$((FAILURES + 1))
else
  log "L0.2b Redis: No crash-loop"
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

# L0.5 — App response time (threshold: >3s)
RESPONSE_TIME=$(curl -sf --max-time 10 -o /dev/null -w "%{time_total}" "${BASE}/health" 2>/dev/null || echo "99")
log "L0.5 Response time: ${RESPONSE_TIME}s"
if [ "$(echo "$RESPONSE_TIME > 3" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
  log "L0.5 Response time: SLOW (${RESPONSE_TIME}s > 3s)"
  WARNINGS=$((WARNINGS + 1))
fi

# L0.6 — App container CPU/RAM
APP_STATS=$(docker stats --no-stream --format "{{.CPUPerc}} {{.MemPerc}} {{.MemUsage}}" "$APP_CONTAINER" 2>/dev/null || echo "0% 0% 0MiB/0GiB")
APP_CPU=$(echo "$APP_STATS" | awk '{print $1}' | tr -d '%')
APP_MEM=$(echo "$APP_STATS" | awk '{print $2}' | tr -d '%')
log "L0.6 App: CPU=${APP_CPU}% MEM=${APP_MEM}% (${APP_STATS})"
if [ "$(echo "${APP_CPU:-0} > 80" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
  log "L0.6 App CPU: HIGH (${APP_CPU}% > 80%)"
  WARNINGS=$((WARNINGS + 1))
fi
if [ "$(echo "${APP_MEM:-0} > 85" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
  log "L0.6 App MEM: HIGH (${APP_MEM}% > 85%)"
  WARNINGS=$((WARNINGS + 1))
fi

# L0.7 — Redis memory vs maxmemory
REDIS_MEM=$(docker exec "$REDIS_CONTAINER" redis-cli INFO memory 2>/dev/null || echo "")
REDIS_USED=$(echo "$REDIS_MEM" | grep "used_memory_human:" | cut -d: -f2 | tr -d '[:space:]')
REDIS_MAX=$(echo "$REDIS_MEM" | grep "maxmemory_human:" | cut -d: -f2 | tr -d '[:space:]')
REDIS_FRAG=$(echo "$REDIS_MEM" | grep "mem_fragmentation_ratio:" | cut -d: -f2 | tr -d '[:space:]')
log "L0.7 Redis mem: used=${REDIS_USED} max=${REDIS_MAX} frag=${REDIS_FRAG}"
if [ "$(echo "${REDIS_FRAG:-1} > 2.0" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
  log "L0.7 Redis fragmentation: HIGH (${REDIS_FRAG} > 2.0)"
  WARNINGS=$((WARNINGS + 1))
fi

# L0.8 — Disk usage (threshold: >85%)
DISK_PCT=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
log "L0.8 Disk: ${DISK_PCT}% used"
if [ "${DISK_PCT:-0}" -gt 85 ]; then
  log "L0.8 Disk: HIGH (${DISK_PCT}% > 85%)"
  WARNINGS=$((WARNINGS + 1))
fi

# L0.9 — System load (threshold: >4 on 16GB server)
LOAD_1M=$(uptime | awk -F'load average:' '{print $2}' | awk -F, '{print $1}' | tr -d ' ')
log "L0.9 Load: ${LOAD_1M} (1min)"
if [ "$(echo "${LOAD_1M:-0} > 4" | bc -l 2>/dev/null || echo 0)" = "1" ]; then
  log "L0.9 Load: HIGH (${LOAD_1M} > 4)"
  WARNINGS=$((WARNINGS + 1))
fi

# Summary + optional webhook alert
if [ $FAILURES -gt 0 ]; then
  log "RESULT: ${FAILURES} failure(s), ${WARNINGS} warning(s) detected"
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -sf --max-time 5 -X POST "${ALERT_WEBHOOK_URL}" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"[AutoMecanik] Health check: ${FAILURES} failure(s), ${WARNINGS} warning(s) at ${TIMESTAMP}\"}" \
      >/dev/null 2>&1 || true
  fi
  exit 1
fi

if [ $WARNINGS -gt 0 ]; then
  log "RESULT: OK with ${WARNINGS} warning(s)"
  exit 0
fi

log "RESULT: All checks passed"
exit 0
