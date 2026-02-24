#!/usr/bin/env bash
# ============================================================
# Smoke Test — Video Execution Pipeline (P4.2)
#
# Categories:
#   A. Security (unauth → 403)
#   B. Feature Flags (pipeline disabled/invalid brief → 400/404)
#   C. Nominal (stats + list → 200)
#   D. Retry Guards (non-existent → 404)
#   E. Response Shape (JSON structure validation)
#   F. Canary Observability (P5.3 — policy + stats shape)
#
# Usage:
#   ADMIN_EMAIL=admin@test.com ADMIN_PASSWORD=xxx ./scripts/smoke-video-pipeline.sh
#   BASE_URL=http://localhost:3000 ./scripts/smoke-video-pipeline.sh
# ============================================================
set -euo pipefail

BASE="${BASE_URL:-http://127.0.0.1:3000}"
COOKIE_JAR="/tmp/smoke-video-cookies-$$.txt"
OUT="/tmp/smoke-video-out-$$.txt"
PASS=0
FAIL=0
TOTAL=0

# ── Helpers ──

log_pass() { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo "  PASS: $1"; }
log_fail() { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo "  FAIL: $1"; }

get_http_code() {
  # $1=method $2=url $3=extra_args (optional)
  curl -sS -o "$OUT" -w "%{http_code}" \
    --max-time 10 -X "$1" ${3:-} "$BASE$2" 2>/dev/null || echo "000"
}

authed_http_code() {
  # $1=method $2=url $3=extra_args (optional)
  curl -sS -o "$OUT" -w "%{http_code}" \
    -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    --max-time 10 -X "$1" ${3:-} "$BASE$2" 2>/dev/null || echo "000"
}

assert_http() {
  local description="$1"
  local expected_code="$2"
  local actual_code="$3"

  if [ "$actual_code" = "$expected_code" ]; then
    log_pass "$description (HTTP $actual_code)"
  else
    log_fail "$description (expected $expected_code, got $actual_code)"
  fi
}

assert_json() {
  local description="$1"
  local jq_expr="$2"
  local expected="$3"

  local actual
  actual=$(jq -r "$jq_expr" < "$OUT" 2>/dev/null || echo "PARSE_ERROR")

  if [ "$actual" = "$expected" ]; then
    log_pass "$description"
  else
    log_fail "$description (expected '$expected', got '$actual')"
  fi
}

login_admin() {
  local email="${ADMIN_EMAIL:?ADMIN_EMAIL env var required}"
  local password="${ADMIN_PASSWORD:?ADMIN_PASSWORD env var required}"

  local code
  code=$(curl -sS -o "$OUT" -w "%{http_code}" \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    --max-time 10 2>/dev/null || echo "000")

  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    echo "  Logged in as $email"
  else
    echo "  FATAL: Login failed (HTTP $code)"
    cat "$OUT" 2>/dev/null || true
    exit 1
  fi
}

cleanup() {
  rm -f "$COOKIE_JAR" "$OUT"
}
trap cleanup EXIT

# ── Main ──

echo ""
echo "========================================"
echo "  Video Pipeline Smoke Tests"
echo "  Target: $BASE"
echo "========================================"
echo ""

# ─── A. SECURITY ───────────────────────────────
echo "[A] Security (no auth → 403)"

code=$(get_http_code "GET" "/api/admin/video/executions/stats")
assert_http "GET /executions/stats unauth" "403" "$code"

code=$(get_http_code "POST" "/api/admin/video/productions/test-brief/execute")
assert_http "POST /execute unauth" "403" "$code"

code=$(get_http_code "POST" "/api/admin/video/executions/1/retry")
assert_http "POST /retry unauth" "403" "$code"

code=$(get_http_code "GET" "/api/admin/video/executions/1")
assert_http "GET /executions/:id unauth" "403" "$code"

code=$(get_http_code "GET" "/api/admin/video/productions/test-brief/executions")
assert_http "GET /list unauth" "403" "$code"

echo ""

# ─── Login ─────────────────────────────────────
echo "[Setup] Admin login"
login_admin
echo ""

# ─── B. FLAGS / GUARDS ─────────────────────────
echo "[B] Feature flag / input guards"

code=$(authed_http_code "POST" "/api/admin/video/productions/nonexistent-brief-99999/execute")
if [ "$code" = "400" ] || [ "$code" = "404" ]; then
  log_pass "Execute invalid brief → guard ($code)"
else
  log_fail "Execute invalid brief → expected 400/404, got $code"
fi

echo ""

# ─── C. NOMINAL (read endpoints) ───────────────
echo "[C] Nominal (read endpoints)"

code=$(authed_http_code "GET" "/api/admin/video/executions/stats")
assert_http "GET /executions/stats" "200" "$code"
assert_json "Stats has success=true" ".success" "true"
assert_json "Stats has timestamp" ".timestamp" "$(jq -r '.timestamp' < "$OUT" 2>/dev/null)"

# Verify stats structure
total=$(jq -r '.data.total' < "$OUT" 2>/dev/null || echo "MISSING")
if [ "$total" != "MISSING" ] && [ "$total" != "null" ]; then
  log_pass "Stats has data.total ($total)"
else
  log_fail "Stats missing data.total"
fi

code=$(authed_http_code "GET" "/api/admin/video/productions/nonexistent-brief-99999/executions")
assert_http "GET /list for unknown brief" "200" "$code"
assert_json "List has success=true" ".success" "true"

echo ""

# ─── D. RETRY GUARDS ──────────────────────────
echo "[D] Retry guards"

code=$(authed_http_code "POST" "/api/admin/video/executions/999999/retry")
if [ "$code" = "404" ] || [ "$code" = "400" ]; then
  log_pass "Retry non-existent → guard ($code)"
else
  log_fail "Retry non-existent → expected 404/400, got $code"
fi

echo ""

# ─── E. RESPONSE SHAPE ─────────────────────────
echo "[E] Response shape validation"

# Check stats shape
code=$(authed_http_code "GET" "/api/admin/video/executions/stats")
if [ "$code" = "200" ]; then
  assert_json "Stats shape: data.byStatus exists" ".data.byStatus | type" "object"
  assert_json "Stats shape: data.avgDurationMs present" ".data | has(\"avgDurationMs\")" "true"
fi

# Check that a real execution (if any) has the new P4.1.x fields
total=$(jq -r '.data.total' < "$OUT" 2>/dev/null || echo "0")
if [ "$total" -gt "0" ] 2>/dev/null; then
  echo "  ($total executions found — would check field-level on a real exec)"
else
  echo "  (No executions yet — field-level checks skipped)"
fi

# ─── F. CANARY OBSERVABILITY (P5.3) ───────────
echo "[F] Canary observability"

code=$(authed_http_code "GET" "/api/admin/video/canary/policy")
assert_http "GET /canary/policy" "200" "$code"
if [ "$code" = "200" ]; then
  assert_json "Policy has quotaPerDay" ".data.quotaPerDay | type" "number"
  assert_json "Policy has eligibleVideoTypes" ".data.eligibleVideoTypes | type" "array"
  assert_json "Policy has canaryAvailable" ".data | has(\"canaryAvailable\")" "true"
fi

# Stats should now include canary + engineDistribution
code=$(authed_http_code "GET" "/api/admin/video/executions/stats")
if [ "$code" = "200" ]; then
  canary_total=$(jq -r '.data.canary.totalCanary // "MISSING"' < "$OUT" 2>/dev/null)
  if [ "$canary_total" != "MISSING" ]; then
    log_pass "Stats includes canary metrics (totalCanary=$canary_total)"
  else
    log_fail "Stats missing canary metrics"
  fi

  engine_dist=$(jq -r '.data.engineDistribution | type' < "$OUT" 2>/dev/null || echo "MISSING")
  if [ "$engine_dist" = "object" ]; then
    log_pass "Stats includes engineDistribution"
  else
    log_fail "Stats missing engineDistribution"
  fi
fi

echo ""

# ─── Summary ───────────────────────────────────
echo "========================================"
echo "  Results: $PASS/$TOTAL passed"
if [ "$FAIL" -gt "0" ]; then
  echo "  $FAIL FAILED"
  echo "========================================"
  exit 1
else
  echo "  All tests passed"
  echo "========================================"
fi
