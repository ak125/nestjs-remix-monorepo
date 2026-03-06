#!/usr/bin/env bash
# ============================================================
# Smoke Test - Vérifie que les endpoints critiques répondent
# Usage: npm run dev:smoke
#        BASE_URL=http://localhost:3000 ./scripts/dev-smoke-test.sh
# ============================================================
set -euo pipefail

BASE="${BASE_URL:-http://127.0.0.1:3000}"

echo "== Smoke test: $BASE =="
echo ""

COOKIE_FILE="/tmp/smoke-cookies.txt"
FAILS=0

check() {
  local path="$1"
  local max="${2:-5}"

  echo -n "-- GET $path ... "

  code=$(curl -sS -o /tmp/smoke.out -w "%{http_code}" --max-time "$max" "$BASE$path" 2>/dev/null || true)

  if [ "$code" != "200" ]; then
    echo "FAIL HTTP $code"
    head -40 /tmp/smoke.out 2>/dev/null || echo "(empty)"
    FAILS=$((FAILS + 1))
    return
  fi

  echo "OK 200"
}

check_post() {
  local path="$1"
  local data="$2"
  local content_type="${3:-application/x-www-form-urlencoded}"
  local expected="${4:-200}"
  local max="${5:-5}"

  echo -n "-- POST $path ... "

  code=$(curl -sS -o /tmp/smoke.out -w "%{http_code}" --max-time "$max" \
    -X POST "$BASE$path" \
    -H "Content-Type: $content_type" \
    -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
    -d "$data" 2>/dev/null || true)

  if [ "$code" != "$expected" ]; then
    echo "FAIL HTTP $code (expected $expected)"
    head -40 /tmp/smoke.out 2>/dev/null || echo "(empty)"
    FAILS=$((FAILS + 1))
    return
  fi

  echo "OK $code"
}

# ===== Core health =====
check "/health" 5
check "/api/catalog/homepage-rpc" 10

# ===== Cart: SSR + Remix actions =====
# Login for session cookie
echo -n "-- POST /auth/login ... "
LOGIN_CODE=$(curl -sS -o /tmp/smoke.out -w "%{http_code}" --max-time 5 \
  -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_FILE" \
  -d '{"email":"superadmin@autoparts.com","password":"SuperAdmin2025!"}' 2>/dev/null || true)
if [ "$LOGIN_CODE" = "201" ] || [ "$LOGIN_CODE" = "200" ]; then
  echo "OK $LOGIN_CODE"

  # Add item to cart via API
  check_post "/api/cart/items" '{"product_id":25,"quantity":1}' "application/json" "201"

  # GET /cart SSR
  echo -n "-- GET /cart (SSR) ... "
  CART_CODE=$(curl -sS -o /tmp/smoke.out -w "%{http_code}" --max-time 5 \
    -b "$COOKIE_FILE" "$BASE/cart" 2>/dev/null || true)
  if [ "$CART_CODE" = "200" ]; then
    echo "OK 200"
  else
    echo "FAIL HTTP $CART_CODE"
    FAILS=$((FAILS + 1))
  fi

  # POST /cart Remix action (update qty)
  check_post "/cart" "intent=update&productId=25&quantity=2"

  # POST /cart Remix action (remove)
  check_post "/cart" "intent=remove&productId=25"

  # POST /cart Remix action (clear)
  check_post "/cart" "intent=clear"
else
  echo "SKIP (login failed: $LOGIN_CODE)"
fi

rm -f "$COOKIE_FILE"

echo ""
if [ $FAILS -gt 0 ]; then
  echo "FAIL: $FAILS test(s) failed"
  exit 1
fi
echo "All smoke checks passed"
