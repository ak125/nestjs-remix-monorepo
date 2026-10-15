#!/usr/bin/env bash
# ==============================================================================
# Disk Usage Alert
# Fires when root filesystem usage exceeds threshold.
# Runs: daily at 2:05am via cron (PROD, installed by scripts/deploy-phase1.sh)
#
# DEV box: every 15 min, crontab of user deploy:
#   */15 * * * * DISK_THRESHOLD=95 CRON_REPORT_MAX_AGE_S=3600 /usr/bin/bash /opt/automecanik/app/scripts/cron/disk-alert.sh >> /tmp/disk-alert-cron.log 2>&1
#   - 95 and not 85: DEV normally sits at 80-90 % (worktrees, Codex workspaces), so 85
#     would alert permanently. 95 % of 150 GB ≈ 7.5 GB free, above the 3 GiB floor below
#     which Hermes refuses to prepare a mission.
#   - 15 min and not daily: on 2026-10-15 free space fell from 2.2 GB to 0.99 GB in 5 h;
#     each time (10-07, 10-13, 10-15) the full disk was only noticed through a failure.
#   - Reader: scripts/claude-hooks/sessionstart-workspace-context.sh shows the alert to
#     every Claude session of the machine (and flags the job as silent after
#     CRON_REPORT_MAX_AGE_S without a run).
#
# Env:
#   DISK_THRESHOLD     — Percentage threshold (default: 85)
#   ALERT_WEBHOOK_URL  — Optional webhook for alerts (Slack/Discord/ntfy)
# ==============================================================================
set -euo pipefail

# Supabase report helper
source "$(dirname "$0")/lib-supabase-report.sh" 2>/dev/null || true

THRESHOLD="${DISK_THRESHOLD:-85}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Root filesystem usage percentage, and free space (the limits that fail are absolute:
# Hermes needs 3 GiB, a worktree resync a few hundred MB).
USAGE=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
FREE=$(df -h / | awk 'NR==2 {print $4}')

# A non-numeric value makes the test below fail inside `if`, which set -e does not
# catch: the script would fall into the OK branch. Report it as an error instead.
if ! [[ "$THRESHOLD" =~ ^[0-9]+$ && "$USAGE" =~ ^[0-9]+$ ]]; then
  echo "[$TIMESTAMP] ERROR: invalid threshold '${THRESHOLD}' or usage '${USAGE}'"
  cron_report "disk-alert" "error" 0 '{}' "ERROR: invalid threshold '${THRESHOLD}' or usage '${USAGE}'"
  exit 2
fi

if [ "$USAGE" -ge "$THRESHOLD" ]; then
  DOCKER_SIZE=$(docker system df --format '{{.Size}}' 2>/dev/null | head -1 || echo "unknown")
  echo "[$TIMESTAMP] ALERT: Disk at ${USAGE}% (>=${THRESHOLD}%), ${FREE} free. Docker images: ${DOCKER_SIZE}"

  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -sf --max-time 5 -X POST "${ALERT_WEBHOOK_URL}" \
      -H "Content-Type: application/json" \
      -d "$(jq -nc --arg text "[AutoMecanik] Disk ALERT: ${USAGE}% (>=${THRESHOLD}%), ${FREE} free. Docker: ${DOCKER_SIZE}" '{text:$text}')" \
      >/dev/null 2>&1 || true
  fi
  cron_report "disk-alert" "error" 0 \
    "$(jq -nc --argjson pct "$USAGE" --arg free "$FREE" --arg docker "$DOCKER_SIZE" '{disk_pct:$pct, free:$free, docker_images:$docker}')" \
    "ALERT: ${USAGE}% (>=${THRESHOLD}%), ${FREE} free"
  exit 1
else
  echo "[$TIMESTAMP] OK: Disk at ${USAGE}% (threshold: ${THRESHOLD}%), ${FREE} free"
  cron_report "disk-alert" "ok" 0 \
    "$(jq -nc --argjson pct "$USAGE" --arg free "$FREE" '{disk_pct:$pct, free:$free}')" \
    "OK: ${USAGE}%, ${FREE} free"
  exit 0
fi
