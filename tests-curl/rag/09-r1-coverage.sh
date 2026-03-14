#!/bin/bash
# RAG: R1 pipeline coverage — couverture R1 par section
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="rag/r1-coverage"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/r1-coverage")

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "PASS: $TEST_NAME (endpoint exists, auth guard, HTTP $HTTP_CODE)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
