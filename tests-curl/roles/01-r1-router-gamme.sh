#!/bin/bash
# R1: page gamme retourne du HTML avec titre correct
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="roles/r1-router-gamme"

RESPONSE=$(curl -s "$BASE_URL/pieces/disque-de-frein-82.html")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/pieces/disque-de-frein-82.html")
HAS_TITLE=$(echo "$RESPONSE" | grep -c '<title>' 2>/dev/null)

if [ "$HTTP_CODE" = "200" ] && [ "$HAS_TITLE" -gt 0 ]; then
  echo "PASS: $TEST_NAME (HTML with title)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE, title=$HAS_TITLE)"
fi
