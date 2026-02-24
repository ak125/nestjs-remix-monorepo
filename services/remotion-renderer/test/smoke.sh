#!/usr/bin/env bash
# ── P6 Render Service — Smoke Tests (RG1-RG7) ──
# Usage: bash test/smoke.sh [RENDER_URL] [BACKEND_URL]
# Exit codes: 0 = all pass, 1 = at least one failure

set -euo pipefail

RENDER_URL="${1:-http://localhost:3100}"
BACKEND_URL="${2:-http://localhost:3000}"
PASS=0
FAIL=0

green()  { printf '\033[32m%s\033[0m\n' "$1"; }
red()    { printf '\033[31m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }

check() {
  local name="$1" result="$2"
  if [ "$result" = "true" ] || [ "$result" = "PASS" ]; then
    green "  PASS: $name"
    ((PASS++))
  else
    red "  FAIL: $name"
    ((FAIL++))
  fi
}

echo ""
echo "================================================"
echo " P6 Render Smoke Tests — $(date -Iseconds)"
echo " RENDER_URL: $RENDER_URL"
echo " BACKEND_URL: $BACKEND_URL"
echo "================================================"
echo ""

# ── RG1: Runtime Dependencies ──
echo "--- RG1: Runtime Dependencies (bloquant) ---"

# Health endpoint checks deps
HEALTH=$(curl -sf "$RENDER_URL/health" 2>/dev/null || echo '{}')
FFMPEG=$(echo "$HEALTH" | jq -r '.ffmpegAvailable // false')
CHROMIUM=$(echo "$HEALTH" | jq -r '.chromiumAvailable // false')
check "RG1.1 FFmpeg available" "$FFMPEG"
check "RG1.2 Chromium available" "$CHROMIUM"

# ── RG2: Health Gate ──
echo ""
echo "--- RG2: Render Engine Health (bloquant canary) ---"

HTTP=$(curl -sf -o /dev/null -w "%{http_code}" "$RENDER_URL/health" 2>/dev/null || echo "000")
check "RG2.1 Health returns 200" "$([ "$HTTP" = "200" ] && echo true || echo false)"

SCHEMA=$(echo "$HEALTH" | jq -r '.schemaVersion // ""')
check "RG2.2 schemaVersion present" "$([ -n "$SCHEMA" ] && echo true || echo false)"

STATUS=$(echo "$HEALTH" | jq -r '.status // ""')
check "RG2.3 status field present" "$([ -n "$STATUS" ] && echo true || echo false)"

TIMESTAMP=$(echo "$HEALTH" | jq -r '.timestamp // ""')
check "RG2.4 timestamp present" "$([ -n "$TIMESTAMP" ] && echo true || echo false)"

RESPONSE_TIME=$(curl -sf -o /dev/null -w "%{time_total}" "$RENDER_URL/health" 2>/dev/null || echo "99")
UNDER_2S=$(echo "$RESPONSE_TIME < 2.0" | bc -l 2>/dev/null || echo "0")
check "RG2.5 Response time < 2s (${RESPONSE_TIME}s)" "$([ "$UNDER_2S" = "1" ] && echo true || echo false)"

# ── RG3: Contract Compatibility ──
echo ""
echo "--- RG3: Contract Compatibility (bloquant) ---"

RESP=$(curl -sf -X POST "$RENDER_URL/render" \
  -H "Content-Type: application/json" \
  -d '{"briefId":"smoke-rg3","executionLogId":99999,"videoType":"short","vertical":"freinage"}' \
  --max-time 180 2>/dev/null || echo '{}')

RESP_SCHEMA=$(echo "$RESP" | jq -r '.schemaVersion // ""')
check "RG3.1 Response has schemaVersion" "$([ "$RESP_SCHEMA" = "1.0.0" ] && echo true || echo false)"

RESP_STATUS=$(echo "$RESP" | jq -r '.status // ""')
check "RG3.2 Response has status" "$([ "$RESP_STATUS" = "success" ] || [ "$RESP_STATUS" = "failed" ] && echo true || echo false)"

RESP_DURATION=$(echo "$RESP" | jq -r '.durationMs // 0')
check "RG3.3 durationMs > 0" "$([ "$RESP_DURATION" -gt 0 ] 2>/dev/null && echo true || echo false)"

# ── RG4: Fallback Safety ──
echo ""
echo "--- RG4: Fallback Safety (bloquant) ---"

BACKEND_HEALTH=$(curl -sf "$BACKEND_URL/health" 2>/dev/null || echo '{}')
BACKEND_OK=$(echo "$BACKEND_HEALTH" | jq -r '.status // ""')
check "RG4.1 Backend healthy" "$([ "$BACKEND_OK" = "ok" ] && echo true || echo false)"

# ── RG5: Error Classification ──
echo ""
echo "--- RG5: Error Classification (important) ---"

ERR_HTTP=$(curl -sf -o /tmp/rg5-smoke.json -w "%{http_code}" -X POST "$RENDER_URL/render" \
  -H "Content-Type: application/json" \
  -d '{"invalid":"payload"}' \
  --max-time 10 2>/dev/null || echo "000")
check "RG5.1 Invalid payload returns 400" "$([ "$ERR_HTTP" = "400" ] && echo true || echo false)"

ERR_CODE=$(jq -r '.errorCode // ""' /tmp/rg5-smoke.json 2>/dev/null || echo "")
check "RG5.2 Error code = INVALID_REQUEST" "$([ "$ERR_CODE" = "INVALID_REQUEST" ] && echo true || echo false)"

ERR_MSG=$(jq -r '.errorMessage // ""' /tmp/rg5-smoke.json 2>/dev/null || echo "")
check "RG5.3 Error message present" "$([ -n "$ERR_MSG" ] && echo true || echo false)"

# ── RG6: Output Integrity ──
echo ""
echo "--- RG6: Output Integrity (important) ---"

if [ "$RESP_STATUS" = "success" ]; then
  OUTPUT=$(echo "$RESP" | jq -r '.outputPath // ""')
  check "RG6.1 outputPath starts with s3://" "$(echo "$OUTPUT" | grep -q '^s3://' && echo true || echo false)"

  FILESIZE=$(echo "$RESP" | jq -r '.metadata.fileSizeBytes // 0')
  check "RG6.2 fileSizeBytes > 0" "$([ "$FILESIZE" -gt 0 ] 2>/dev/null && echo true || echo false)"

  CODEC=$(echo "$RESP" | jq -r '.metadata.codec // ""')
  check "RG6.3 codec present" "$([ -n "$CODEC" ] && echo true || echo false)"
else
  yellow "  SKIP: RG6 (render status=$RESP_STATUS, not success)"
fi

# ── RG7: Observability ──
echo ""
echo "--- RG7: Observability (important) ---"

S3_CONNECTED=$(echo "$HEALTH" | jq -r '.s3Connected // false')
check "RG7.1 S3 connectivity reported" "$([ "$S3_CONNECTED" = "true" ] || [ "$S3_CONNECTED" = "false" ] && echo true || echo false)"

if [ "$RESP_STATUS" = "success" ]; then
  REMOTION_V=$(echo "$RESP" | jq -r '.metadata.remotionVersion // ""')
  check "RG7.2 remotionVersion in metadata" "$([ -n "$REMOTION_V" ] && echo true || echo false)"

  FFMPEG_V=$(echo "$RESP" | jq -r '.metadata.ffmpegVersion // ""')
  check "RG7.3 ffmpegVersion in metadata" "$([ -n "$FFMPEG_V" ] && echo true || echo false)"

  COMP_ID=$(echo "$RESP" | jq -r '.metadata.compositionId // ""')
  check "RG7.4 compositionId in metadata" "$([ -n "$COMP_ID" ] && echo true || echo false)"
else
  yellow "  SKIP: RG7.2-7.4 (render status=$RESP_STATUS)"
fi

# ── Summary ──
echo ""
echo "================================================"
TOTAL=$((PASS + FAIL))
echo " Results: $PASS/$TOTAL passed"
if [ "$FAIL" -gt 0 ]; then
  red " $FAIL FAILED"
  echo "================================================"
  exit 1
else
  green " ALL PASSED"
  echo "================================================"
  exit 0
fi
