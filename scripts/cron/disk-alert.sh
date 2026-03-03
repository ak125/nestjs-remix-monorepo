#!/usr/bin/env bash
# ==============================================================================
# Disk Usage Alert
# Fires when root filesystem usage exceeds threshold.
# Runs: daily at 2:05am via cron
#
# Env:
#   DISK_THRESHOLD     — Percentage threshold (default: 85)
#   ALERT_WEBHOOK_URL  — Optional webhook for alerts (Slack/Discord/ntfy)
# ==============================================================================
set -euo pipefail

THRESHOLD="${DISK_THRESHOLD:-85}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Root filesystem usage percentage
USAGE=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')

if [ "$USAGE" -ge "$THRESHOLD" ]; then
  DOCKER_SIZE=$(docker system df --format '{{.Size}}' 2>/dev/null | head -1 || echo "unknown")
  echo "[$TIMESTAMP] ALERT: Disk at ${USAGE}% (>=${THRESHOLD}%). Docker images: ${DOCKER_SIZE}"

  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -sf --max-time 5 -X POST "${ALERT_WEBHOOK_URL}" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"[AutoMecanik] Disk ALERT: ${USAGE}% (>=${THRESHOLD}%). Docker: ${DOCKER_SIZE}\"}" \
      >/dev/null 2>&1 || true
  fi
  exit 1
else
  echo "[$TIMESTAMP] OK: Disk at ${USAGE}% (threshold: ${THRESHOLD}%)"
  exit 0
fi
