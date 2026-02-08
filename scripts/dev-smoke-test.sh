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

check() {
  local path="$1"
  local max="${2:-5}"

  echo -n "-- GET $path ... "

  code=$(curl -sS -o /tmp/smoke.out -w "%{http_code}" --max-time "$max" "$BASE$path" 2>/dev/null || true)

  if [ "$code" != "200" ]; then
    echo "❌ HTTP $code"
    echo "Response:"
    head -40 /tmp/smoke.out 2>/dev/null || echo "(empty)"
    exit 1
  fi

  echo "✅ 200 OK"
}

# Tests critiques
check "/health" 5
check "/api/cart" 5
check "/api/catalog/homepage-rpc" 10

echo ""
echo "✅ All smoke checks passed"
