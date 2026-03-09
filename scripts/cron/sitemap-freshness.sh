#!/usr/bin/env bash
# ==============================================================================
# Sitemap Freshness Check — Weekly sitemap health validation
#
# Checks: sitemap accessible, lastmod < 7 days, sub-sitemaps count, robots.txt
# Runs: Monday 4:00am via Supercronic (after SEO audit at 3:00)
#
# Env:
#   SITE_URL — Site base URL (default: https://www.automecanik.com)
# ==============================================================================
set -euo pipefail

# Supabase report helper
source "$(dirname "$0")/lib-supabase-report.sh" 2>/dev/null || true
_SF_START=$(date +%s)

SITE_URL="${SITE_URL:-https://www.automecanik.com}"
SITEMAP_URL="${SITE_URL}/sitemap.xml"
ROBOTS_URL="${SITE_URL}/robots.txt"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
STATUS="ok"
WARNINGS=0
ERRORS=0

log() { echo "[$TIMESTAMP] $1"; }

# Check 1: Sitemap accessible
log "Check 1: Fetching ${SITEMAP_URL}"
SITEMAP_HTTP=$(curl -sf -o /tmp/sitemap-check.xml -w "%{http_code}" --max-time 30 "$SITEMAP_URL" 2>/dev/null || echo "000")

if [ "$SITEMAP_HTTP" != "200" ]; then
  log "FAIL: Sitemap returned HTTP ${SITEMAP_HTTP}"
  ERRORS=$((ERRORS + 1))
  STATUS="error"
else
  log "OK: Sitemap HTTP 200"
fi

# Check 2: lastmod freshness (< 7 days)
LASTMOD_COUNT=0
STALE_COUNT=0
if [ -f /tmp/sitemap-check.xml ] && [ "$SITEMAP_HTTP" = "200" ]; then
  NOW_EPOCH=$(date +%s)
  SEVEN_DAYS=$((7 * 86400))

  # Extract lastmod dates from sitemap index
  while IFS= read -r lastmod; do
    [ -z "$lastmod" ] && continue
    LASTMOD_COUNT=$((LASTMOD_COUNT + 1))
    # Parse ISO date to epoch
    LM_EPOCH=$(date -d "$lastmod" +%s 2>/dev/null || echo "0")
    AGE=$((NOW_EPOCH - LM_EPOCH))
    if [ "$AGE" -gt "$SEVEN_DAYS" ]; then
      STALE_COUNT=$((STALE_COUNT + 1))
    fi
  done < <(grep -oP '(?<=<lastmod>)[^<]+' /tmp/sitemap-check.xml 2>/dev/null || true)

  if [ "$LASTMOD_COUNT" -eq 0 ]; then
    log "WARN: No <lastmod> tags found in sitemap"
    WARNINGS=$((WARNINGS + 1))
    [ "$STATUS" = "ok" ] && STATUS="warn"
  elif [ "$STALE_COUNT" -gt 0 ]; then
    log "WARN: ${STALE_COUNT}/${LASTMOD_COUNT} sub-sitemaps have lastmod > 7 days"
    WARNINGS=$((WARNINGS + 1))
    [ "$STATUS" = "ok" ] && STATUS="warn"
  else
    log "OK: All ${LASTMOD_COUNT} sub-sitemaps updated within 7 days"
  fi
fi

# Check 3: Sub-sitemap count (expect > 5 for a 4M+ product catalog)
SUB_COUNT=0
if [ -f /tmp/sitemap-check.xml ] && [ "$SITEMAP_HTTP" = "200" ]; then
  SUB_COUNT=$(grep -c '<loc>' /tmp/sitemap-check.xml 2>/dev/null || echo "0")
  if [ "$SUB_COUNT" -lt 5 ]; then
    log "WARN: Only ${SUB_COUNT} sub-sitemaps (expected > 5 for 4M+ products)"
    WARNINGS=$((WARNINGS + 1))
    [ "$STATUS" = "ok" ] && STATUS="warn"
  else
    log "OK: ${SUB_COUNT} sub-sitemaps found"
  fi
fi

# Check 4: robots.txt references sitemap
log "Check 4: Verifying robots.txt"
ROBOTS_HTTP=$(curl -sf -o /tmp/robots-check.txt -w "%{http_code}" --max-time 10 "$ROBOTS_URL" 2>/dev/null || echo "000")
ROBOTS_HAS_SITEMAP=false
if [ "$ROBOTS_HTTP" = "200" ] && grep -qi "sitemap:" /tmp/robots-check.txt 2>/dev/null; then
  log "OK: robots.txt references sitemap"
  ROBOTS_HAS_SITEMAP=true
elif [ "$ROBOTS_HTTP" != "200" ]; then
  log "WARN: robots.txt returned HTTP ${ROBOTS_HTTP}"
  WARNINGS=$((WARNINGS + 1))
  [ "$STATUS" = "ok" ] && STATUS="warn"
else
  log "WARN: robots.txt does not reference sitemap"
  WARNINGS=$((WARNINGS + 1))
  [ "$STATUS" = "ok" ] && STATUS="warn"
fi

log "RESULT: status=${STATUS} errors=${ERRORS} warnings=${WARNINGS}"

# Cleanup
rm -f /tmp/sitemap-check.xml /tmp/robots-check.txt

# Report to Supabase
_SF_END=$(date +%s)
_SF_DUR=$((_SF_END - _SF_START))
cron_report "sitemap-freshness" "$STATUS" "$_SF_DUR" \
  "$(jq -nc --argjson http "$SITEMAP_HTTP" --argjson subs "$SUB_COUNT" \
    --argjson stale "$STALE_COUNT" --argjson total "$LASTMOD_COUNT" \
    --argjson robots "$ROBOTS_HAS_SITEMAP" --argjson errs "$ERRORS" --argjson warns "$WARNINGS" \
    '{sitemap_http:$http, sub_sitemaps:$subs, stale_sitemaps:$stale, lastmod_total:$total, robots_ok:$robots, errors:$errs, warnings:$warns}' 2>/dev/null || \
    printf '{"sitemap_http":%s,"sub_sitemaps":%s,"stale_sitemaps":%s}' "$SITEMAP_HTTP" "$SUB_COUNT" "$STALE_COUNT")" \
  "HTTP=${SITEMAP_HTTP} subs=${SUB_COUNT} stale=${STALE_COUNT} E=${ERRORS} W=${WARNINGS}"

exit 0
