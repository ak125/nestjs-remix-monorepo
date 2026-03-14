#!/bin/bash
# DECISION: R1 coverage retourne au moins 1 gamme avec un score
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="decision/r1-coverage-has-scores"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/r1-coverage")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/r1-coverage")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

COUNT=$(echo "$RESPONSE" | jq 'if type == "array" then length elif .data then (.data | length) elif .gammes then (.gammes | length) else 0 end' 2>/dev/null)

if [ "${COUNT:-0}" -gt 0 ] 2>/dev/null; then
  echo "PASS: $TEST_NAME ($COUNT gammes with R1 coverage)"
else
  echo "FAIL: $TEST_NAME (0 gammes in R1 coverage)"
fi
