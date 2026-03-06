#!/bin/bash
# Test Payment Tunnel — 10 tests curl read-only
# Usage: bash scripts/test-payment-tunnel.sh
# Cron: */15 * * * * /app/scripts/test-payment-tunnel.sh >> /logs/payment-tunnel.log 2>&1

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=10

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

check_status() {
  local test_num=$1 desc=$2 url=$3 expected=$4 method=${5:-GET} body=${6:-}
  local opts=(-s -o /dev/null -w "%{http_code}" --max-time 10)

  if [ "$method" = "POST" ]; then
    opts+=(-X POST -H "Content-Type: application/x-www-form-urlencoded")
    [ -n "$body" ] && opts+=(-d "$body")
  fi

  local status
  status=$(curl "${opts[@]}" "$url")

  if [ "$status" = "$expected" ]; then
    log "PASS [$test_num/10] $desc → $status"
    PASS=$((PASS + 1))
  else
    log "FAIL [$test_num/10] $desc → $status (expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

check_body() {
  local test_num=$1 desc=$2 url=$3 expected_pattern=$4
  local body
  body=$(curl -s --max-time 10 "$url")

  if echo "$body" | grep -qiE "$expected_pattern"; then
    log "PASS [$test_num/10] $desc → body contains '$expected_pattern'"
    PASS=$((PASS + 1))
  else
    log "FAIL [$test_num/10] $desc → body missing '$expected_pattern'"
    FAIL=$((FAIL + 1))
  fi
}

log "=== Payment Tunnel Test Suite ==="

# 1. Health check
check_status 1 "Health check" "$BASE_URL/health" "200"

# 2. Homepage
check_status 2 "Homepage" "$BASE_URL/" "200"

# 3. Cart page
check_status 3 "Cart page" "$BASE_URL/cart" "200"

# 4. Checkout payment (no orderId → redirect)
check_status 4 "Checkout payment (no orderId)" "$BASE_URL/checkout-payment" "302"

# 5. Checkout payment return (no params → error message)
check_body 5 "Payment return (no params)" "$BASE_URL/checkout-payment-return" "introuvable|erreur|error"

# 6. Paybox redirect API (no params → 400)
check_status 6 "Paybox redirect (no params)" "$BASE_URL/api/paybox/redirect" "400"

# 7. Paybox redirect API (fake orderId → 400)
check_status 7 "Paybox redirect (fake order)" "$BASE_URL/api/paybox/redirect?orderId=FAKE-999" "400"

# 8. Paybox callback POST (no params → 400 Zod reject)
check_status 8 "Callback POST (no params)" "$BASE_URL/api/paybox/callback" "400" "POST"

# 9. Paybox callback POST (fake order + fake sig → 403 strict / 500 shadow)
status9=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST -H "Content-Type: application/x-www-form-urlencoded" "$BASE_URL/api/paybox/callback?Ref=FAKE-ORDER&Erreur=00000&K=fakesig123")
if [ "$status9" = "403" ] || [ "$status9" = "500" ]; then
  log "PASS [9/10] Callback POST (fake order) → $status9 (rejected)"
  PASS=$((PASS + 1))
else
  log "FAIL [9/10] Callback POST (fake order) → $status9 (expected 403 or 500)"
  FAIL=$((FAIL + 1))
fi

# 10. Catalog families API
check_status 10 "Catalog families API" "$BASE_URL/api/catalog/families" "200"

log "=== Results: $PASS/$TOTAL passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
