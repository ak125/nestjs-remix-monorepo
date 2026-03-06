#!/bin/bash
# prod-watchdog.sh — Production health watchdog (cron every 5 min)
# Install: crontab -e → */5 * * * * /home/deploy/production/watchdog.sh
# Checks: container running, correct image, health OK, Caddy up

LOG="/var/log/prod-watchdog.log"
EXPECTED_IMAGE="massdoc/nestjs-remix-monorepo:production"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
MAX_LOG_LINES=1000

alert() {
  local msg="$1"
  echo "$(date -Iseconds) ALERT: $msg" >> "$LOG"

  # Slack notification (if configured)
  if [ -n "$SLACK_WEBHOOK" ]; then
    curl -s -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\": \"PROD WATCHDOG: $msg\"}" > /dev/null 2>&1
  fi
}

# Rotate log if too large
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG" 2>/dev/null)" -gt "$MAX_LOG_LINES" ]; then
  tail -n 500 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi

# Check 1: Container running
if ! docker ps --format '{{.Names}}' | grep -q "^nestjs-remix-monorepo-prod$"; then
  alert "prod container not running"
  exit 1
fi

# Check 2: Correct image
ACTUAL_IMAGE=$(docker inspect nestjs-remix-monorepo-prod --format='{{.Config.Image}}' 2>/dev/null)
if [ "$ACTUAL_IMAGE" != "$EXPECTED_IMAGE" ]; then
  alert "wrong image: $ACTUAL_IMAGE (expected $EXPECTED_IMAGE)"
  exit 1
fi

# Check 3: Health check
if ! docker exec nestjs-remix-monorepo-prod wget -qO- http://localhost:3000/health 2>/dev/null | grep -q '"status":"ok"'; then
  alert "health check failed (image: $ACTUAL_IMAGE)"
  exit 1
fi

# Check 4: Caddy running
if ! docker ps --format '{{.Names}}' | grep -q "^nestjs-remix-caddy$"; then
  alert "Caddy container not running"
  exit 1
fi

# Check 5: Same network
APP_NETWORK=$(docker inspect nestjs-remix-monorepo-prod --format='{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)
CADDY_NETWORK=$(docker inspect nestjs-remix-caddy --format='{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)
if [ "$APP_NETWORK" != "$CADDY_NETWORK" ]; then
  alert "network mismatch: app=$APP_NETWORK caddy=$CADDY_NETWORK"
  exit 1
fi

# All checks passed (silent, no log spam)
exit 0
