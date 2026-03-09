#!/bin/bash
# =============================================================================
# Lighthouse CWV Cron — Runs Lighthouse audits and stores results in Supabase
# Scheduled via Supercronic inside Docker container (4x/day)
# =============================================================================

set -euo pipefail

# --- Configuration -----------------------------------------------------------
SITE_URL="${SITE_URL:-https://www.automecanik.com}"
SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL is required}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"
CHROME_PATH="${CHROME_PATH:-/usr/bin/chromium}"

# URLs to audit
URLS=(
  "/"
  "/pieces/plaquette-de-frein/renault/clio-iv/diesel.html"
  "/pieces/kit-distribution"
  "/cart"
  "/checkout"
  "/contact"
)

# CWV thresholds (fail if exceeded)
THRESH_FCP=1800
THRESH_LCP=2500
THRESH_CLS=0.1
THRESH_TBT=200

# --- Helpers -----------------------------------------------------------------
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

supabase_post() {
  local table="$1" payload="$2"
  curl -sf -X POST "${SUPABASE_URL}/rest/v1/${table}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$payload"
}

supabase_get() {
  local table="$1" query="$2"
  curl -sf "${SUPABASE_URL}/rest/v1/${table}?${query}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json"
}

# Compare float: returns 0 (true) if $1 > $2
float_gt() {
  awk "BEGIN { exit !($1 > $2) }"
}

# --- Main loop ---------------------------------------------------------------
log "=== Lighthouse CWV audit started ==="
log "Site: ${SITE_URL} | URLs: ${#URLS[@]}"

FAIL_COUNT=0

for path in "${URLS[@]}"; do
  full_url="${SITE_URL}${path}"
  log "Auditing: ${full_url}"

  # Run Lighthouse with low priority
  JSON=$(nice -n 19 lighthouse "$full_url" \
    --chrome-flags="--headless --no-sandbox --disable-gpu --disable-dev-shm-usage" \
    --output=json \
    --quiet \
    --only-categories=performance,accessibility,seo,best-practices \
    2>/dev/null) || {
    log "ERROR: Lighthouse failed for ${path}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  }

  # Extract metrics
  FCP=$(echo "$JSON" | jq -r '.audits["first-contentful-paint"].numericValue // 0 | floor')
  LCP=$(echo "$JSON" | jq -r '.audits["largest-contentful-paint"].numericValue // 0 | floor')
  CLS=$(echo "$JSON" | jq -r '.audits["cumulative-layout-shift"].numericValue // 0')
  TBT=$(echo "$JSON" | jq -r '.audits["total-blocking-time"].numericValue // 0 | floor')
  SI=$(echo "$JSON" | jq -r '.audits["speed-index"].numericValue // 0 | floor')
  TTFB=$(echo "$JSON" | jq -r '.audits["server-response-time"].numericValue // 0 | floor')

  PERF=$(echo "$JSON" | jq -r '(.categories.performance.score // 0) * 100 | floor')
  A11Y=$(echo "$JSON" | jq -r '(.categories.accessibility.score // 0) * 100 | floor')
  SEO=$(echo "$JSON" | jq -r '(.categories.seo.score // 0) * 100 | floor')
  BP=$(echo "$JSON" | jq -r '(.categories["best-practices"].score // 0) * 100 | floor')

  # Determine CWV pass/fail
  CWV_PASS=true
  if float_gt "$FCP" "$THRESH_FCP" || float_gt "$LCP" "$THRESH_LCP" || \
     float_gt "$CLS" "$THRESH_CLS" || float_gt "$TBT" "$THRESH_TBT"; then
    CWV_PASS=false
  fi

  log "  Perf=${PERF} FCP=${FCP}ms LCP=${LCP}ms CLS=${CLS} TBT=${TBT}ms CWV=${CWV_PASS}"

  # Insert into __lighthouse_runs
  PAYLOAD=$(jq -nc \
    --arg url "$path" \
    --argjson fcp "$FCP" --argjson lcp "$LCP" --argjson cls "$CLS" \
    --argjson tbt "$TBT" --argjson si "$SI" --argjson ttfb "$TTFB" \
    --argjson perf "$PERF" --argjson a11y "$A11Y" --argjson seo "$SEO" --argjson bp "$BP" \
    --argjson cwv "$CWV_PASS" \
    '{
      url: $url, fcp_ms: $fcp, lcp_ms: $lcp, cls: $cls,
      tbt_ms: $tbt, si_ms: $si, ttfb_ms: $ttfb,
      perf_score: $perf, a11y_score: $a11y, seo_score: $seo, bp_score: $bp,
      cwv_pass: $cwv
    }')

  supabase_post "__lighthouse_runs" "$PAYLOAD" || log "  WARN: Failed to insert run"

  # --- Alert check: 2 consecutive failures on same metric ---
  PREV_RUNS=$(supabase_get "__lighthouse_runs" \
    "url=eq.$(printf '%s' "$path" | jq -sRr @uri)&order=created_at.desc&limit=2&select=fcp_ms,lcp_ms,cls,tbt_ms") || {
    log "  WARN: Could not fetch previous runs for alert check"
    continue
  }

  PREV_COUNT=$(echo "$PREV_RUNS" | jq 'length')
  if [ "$PREV_COUNT" -ge 2 ]; then
    # Check each metric for 2x consecutive breach
    for metric_info in "fcp_ms:${THRESH_FCP}:FCP" "lcp_ms:${THRESH_LCP}:LCP" "cls:${THRESH_CLS}:CLS" "tbt_ms:${THRESH_TBT}:TBT"; do
      IFS=: read -r field thresh label <<< "$metric_info"
      val1=$(echo "$PREV_RUNS" | jq -r ".[0].${field} // 0")
      val2=$(echo "$PREV_RUNS" | jq -r ".[1].${field} // 0")

      if float_gt "$val1" "$thresh" && float_gt "$val2" "$thresh"; then
        log "  ALERT: ${label} exceeded ${thresh} for 2 consecutive runs (${val1}, ${val2})"
        ALERT_PAYLOAD=$(jq -nc \
          --arg url "$path" --arg metric "$label" \
          --argjson thresh "$thresh" --argjson v1 "$val1" --argjson v2 "$val2" \
          '{ url: $url, metric: $metric, threshold: $thresh, value_run1: $v1, value_run2: $v2 }')
        supabase_post "__lighthouse_alerts" "$ALERT_PAYLOAD" || log "  WARN: Failed to insert alert"
      fi
    done
  fi

  # Throttle between URLs to avoid overloading
  sleep 5
done

log "=== Lighthouse CWV audit finished (failures: ${FAIL_COUNT}/${#URLS[@]}) ==="
