#!/usr/bin/env bash
# Sitemap freshness SLO check.
#
# Pourquoi ce check existe
# ------------------------
# Incident traffic-drop 2026-04-22 → 2026-05-13 : <lastmod> du sitemap
# figé pendant 21 jours (cron générateur silencieusement inerte). Aucun
# moyen de détecter avant que GSC montre la dégradation impressions.
# Ce check appelle l'endpoint /api/sitemap/v10/freshness (PR ouvrant
# l'observabilité) et fail si la dernière régénération est trop ancienne.
#
# Usage
# -----
#   ./check-sitemap-freshness.sh [URL] [warnThresholdHours]
#
# Defaults:
#   URL = $SEO_FRESHNESS_URL ou https://www.automecanik.com/api/sitemap/v10/freshness
#   warnThresholdHours = $SEO_FRESHNESS_WARN_HOURS ou 36
#
# Exit codes:
#   0 — sitemap fresh, scheduler enregistré
#   1 — sitemap stale OU scheduler absent OU endpoint inaccessible

set -euo pipefail

URL="${1:-${SEO_FRESHNESS_URL:-https://www.automecanik.com/api/sitemap/v10/freshness}}"
WARN_THRESHOLD_HOURS="${2:-${SEO_FRESHNESS_WARN_HOURS:-36}}"

echo "🛰️  Checking sitemap freshness: $URL"
echo "   Threshold: ${WARN_THRESHOLD_HOURS}h"
echo ""

RESPONSE="$(mktemp)"
trap 'rm -f "$RESPONSE"' EXIT

HTTP_CODE=$(curl -sS -L --max-time 30 -o "$RESPONSE" -w "%{http_code}" "$URL" || echo "000")

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Endpoint returned HTTP $HTTP_CODE (expected 200)."
  echo ""
  echo "Body (first 500 bytes):"
  head -c 500 "$RESPONSE"
  echo ""
  exit 1
fi

# Pretty-print the JSON for the CI log
if command -v python3 >/dev/null 2>&1; then
  python3 -m json.tool < "$RESPONSE" || cat "$RESPONSE"
elif command -v jq >/dev/null 2>&1; then
  jq . < "$RESPONSE"
else
  cat "$RESPONSE"
fi
echo ""

# Extract verdict — keep parsing minimal to avoid jq dependency in CI
IS_HEALTHY=$(python3 -c "
import json, sys
with open('$RESPONSE') as f:
    d = json.load(f)
print('true' if d.get('isHealthy') is True else 'false')
")
STALE_HOURS=$(python3 -c "
import json
with open('$RESPONSE') as f:
    d = json.load(f)
print(d.get('staleHours') if d.get('staleHours') is not None else 'null')
")
SCHEDULER_REGISTERED=$(python3 -c "
import json
with open('$RESPONSE') as f:
    d = json.load(f)
print('true' if d.get('schedulerRegistered') is True else 'false')
")
REASON=$(python3 -c "
import json
with open('$RESPONSE') as f:
    d = json.load(f)
print(d.get('reason') or '')
")

echo "Summary:"
echo "  staleHours: $STALE_HOURS (threshold ${WARN_THRESHOLD_HOURS}h)"
echo "  schedulerRegistered: $SCHEDULER_REGISTERED"
echo "  isHealthy: $IS_HEALTHY"
if [ -n "$REASON" ]; then
  echo "  reason: $REASON"
fi
echo ""

EXIT=0
if [ "$IS_HEALTHY" != "true" ]; then
  echo "❌ Sitemap freshness UNHEALTHY"
  EXIT=1
fi
if [ "$SCHEDULER_REGISTERED" != "true" ]; then
  echo "⚠️  BullMQ scheduler 'sitemap-regenerate-all' is NOT registered."
  echo "   The fs file may still be fresh from a manual POST, but auto-regen is broken."
  EXIT=1
fi

if [ "$EXIT" -eq 0 ]; then
  echo "✅ Sitemap freshness OK"
fi
exit "$EXIT"
