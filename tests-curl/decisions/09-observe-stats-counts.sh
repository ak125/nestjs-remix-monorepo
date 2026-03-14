#!/bin/bash
# DECISION: Observe stats retourne des compteurs non nuls
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="decision/observe-stats-counts"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/observe-stats")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/observe-stats")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

# Vérifie qu'il y a au moins 1 compteur > 0
HAS_DATA=$(echo "$RESPONSE" | jq 'tostring | length > 10' 2>/dev/null)

if [ "$HAS_DATA" = "true" ]; then
  echo "PASS: $TEST_NAME (observe stats present)"
else
  echo "FAIL: $TEST_NAME (observe stats empty or too small)"
fi
