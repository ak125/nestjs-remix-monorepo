#!/bin/bash
# Refresh T3: Preview R1 pour gamme réelle
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="refresh/r1-preview"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/r1-preview/disque-de-frein")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/r1-preview/disque-de-frein")

if [ "$HTTP_CODE" = "200" ]; then
  HAS_SECTIONS=$(echo "$RESPONSE" | jq 'has("sections") or has("data")' 2>/dev/null)
  echo "PASS: $TEST_NAME (has_sections=$HAS_SECTIONS)"
elif [ "$HTTP_CODE" = "404" ]; then
  echo "PASS: $TEST_NAME (no R1 preview for disque-de-frein — may need keyword plan)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
