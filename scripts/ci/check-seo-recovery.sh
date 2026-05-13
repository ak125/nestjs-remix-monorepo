#!/usr/bin/env bash
# SEO recovery watchdog.
#
# Probes GET /api/seo/monitor/recovery-status and fails if the post-incident
# recovery is stalled. Triggered daily by .github/workflows/seo-recovery-watchdog.yml
# starting D+3 after the PR #487 deploy.
#
# Exit codes:
#   0 — status in {recovered, recovering, in_progress, insufficient_data}
#   1 — status in {degraded, failed} OR endpoint unreachable
#
# Usage:
#   ./check-seo-recovery.sh [URL]
# Default URL = $SEO_RECOVERY_URL or https://www.automecanik.com/api/seo/monitor/recovery-status

set -euo pipefail

URL="${1:-${SEO_RECOVERY_URL:-https://www.automecanik.com/api/seo/monitor/recovery-status}}"

echo "🩺 Probing SEO recovery: $URL"
echo ""

RESPONSE="$(mktemp)"
trap 'rm -f "$RESPONSE"' EXIT

HTTP_CODE=$(curl -sS -L --max-time 30 -o "$RESPONSE" -w "%{http_code}" "$URL" || echo "000")

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Endpoint returned HTTP $HTTP_CODE (expected 200)."
  echo ""
  head -c 500 "$RESPONSE"; echo ""
  exit 1
fi

# Pretty-print for CI log
python3 -m json.tool < "$RESPONSE" || cat "$RESPONSE"
echo ""

STATUS=$(python3 -c "
import json
with open('$RESPONSE') as f:
    d = json.load(f)
print(d.get('status') or 'unknown')
")
MESSAGE=$(python3 -c "
import json
with open('$RESPONSE') as f:
    d = json.load(f)
print(d.get('message') or '')
")

echo "Verdict: $STATUS"
echo "  $MESSAGE"
echo ""

case "$STATUS" in
  recovered)
    echo "✅ Recovery complete — disable this workflow once stable for a week."
    exit 0
    ;;
  recovering|in_progress|insufficient_data)
    echo "✅ Healthy progression — no action."
    exit 0
    ;;
  degraded)
    echo "⚠️  Recovery STALLED (not yet past deadline). Manual review recommended:"
    echo "   1. GSC Coverage report — any new errors on /pieces/* ?"
    echo "   2. Sitemap freshness endpoint — still serving today's <lastmod> ?"
    echo "   3. Top URLs (audit-reports/seo-smoke/2026-05-13/PHASE-MINUS-1-REPORT.md) — re-submit via URL Inspection ?"
    exit 1
    ;;
  failed)
    echo "❌ Recovery FAILED past deadline. Open a fresh Phase −1 investigation."
    echo "   The sitemap fix alone was not sufficient — the cause is elsewhere."
    exit 1
    ;;
  *)
    echo "❓ Unknown status '$STATUS' — inspect raw JSON above."
    exit 1
    ;;
esac
