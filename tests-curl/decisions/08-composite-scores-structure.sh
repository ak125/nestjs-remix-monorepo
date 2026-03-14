#!/bin/bash
# DECISION: Composite scores retourne des gammes avec scores structurés
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="decision/composite-scores-structure"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/composite-scores")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/composite-scores")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

COUNT=$(echo "$RESPONSE" | jq 'if type == "array" then length elif .data then (.data | length) else 0 end' 2>/dev/null)

if [ "${COUNT:-0}" -gt 0 ] 2>/dev/null; then
  echo "PASS: $TEST_NAME ($COUNT entries with composite scores)"
else
  echo "FAIL: $TEST_NAME (0 entries)"
fi
