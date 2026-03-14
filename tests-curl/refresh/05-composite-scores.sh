#!/bin/bash
# Refresh T3: Scores composites calculés
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="refresh/composite-scores"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/composite-scores")

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
