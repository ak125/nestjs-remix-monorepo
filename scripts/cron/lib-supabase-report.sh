#!/usr/bin/env bash
# ==============================================================================
# lib-supabase-report.sh — Shared helper for cron jobs to report to Supabase
#
# Usage:
#   source "$(dirname "$0")/lib-supabase-report.sh" 2>/dev/null || \
#     source /opt/automecanik/app/scripts/cron/lib-supabase-report.sh 2>/dev/null || true
#
#   cron_report "job-name" "ok|warn|error" duration_s '{"key": val}' "Summary text"
#
# Throttle: "ok" status is only reported if last report was >30min ago or
#           status changed. Errors/warnings are ALWAYS reported immediately.
# ==============================================================================

# Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment
_CRON_REPORT_URL="${SUPABASE_URL:-}"
_CRON_REPORT_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

cron_report() {
  local job_name="$1"
  local status="$2"
  local duration_s="${3:-0}"
  local metrics="${4:-{}}"
  local summary="${5:-}"

  # Sanitize: ensure duration_s is a valid number for jq --argjson
  if ! [[ "$duration_s" =~ ^[0-9]+$ ]]; then
    duration_s=0
  fi
  # Sanitize: ensure metrics is valid JSON for jq --argjson
  if ! echo "$metrics" | jq empty 2>/dev/null; then
    metrics='{}'
  fi

  # Skip silently if Supabase not configured
  if [ -z "$_CRON_REPORT_URL" ] || [ -z "$_CRON_REPORT_KEY" ]; then
    return 0
  fi

  # --- Throttle: skip "ok" reports if same status within 30 min ---
  local _throttle_file="/tmp/.cron_last_${job_name}"
  if [ "$status" = "ok" ] && [ -f "$_throttle_file" ]; then
    local _last_status _last_ts _now
    _last_status=$(head -1 "$_throttle_file" 2>/dev/null || echo "")
    _last_ts=$(tail -1 "$_throttle_file" 2>/dev/null || echo "0")
    _now=$(date +%s)
    if [ "$_last_status" = "ok" ] && [ $((_now - _last_ts)) -lt 1800 ]; then
      return 0
    fi
  fi

  # --- Build JSON payload ---
  local payload
  if command -v jq &>/dev/null; then
    payload=$(jq -nc \
      --arg jn "$job_name" \
      --arg st "$status" \
      --argjson dur "$duration_s" \
      --argjson met "$metrics" \
      --arg sum "$summary" \
      '{job_name: $jn, status: $st, duration_s: $dur, metrics: $met, summary: $sum}')
  else
    # Fallback: construct JSON without jq
    payload=$(printf '{"job_name":"%s","status":"%s","duration_s":%s,"metrics":%s,"summary":"%s"}' \
      "$job_name" "$status" "$duration_s" "$metrics" "$summary")
  fi

  curl -sf -X POST "${_CRON_REPORT_URL}/rest/v1/__cron_runs" \
    -H "apikey: ${_CRON_REPORT_KEY}" \
    -H "Authorization: Bearer ${_CRON_REPORT_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$payload" >/dev/null 2>&1 || true

  # --- Update throttle file ---
  echo "$status" > "$_throttle_file"
  date +%s >> "$_throttle_file"
}
