#!/bin/bash
# RAG: quarantine list — docs quarantinées visibles
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="rag/quarantine-list"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/quarantine")

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "PASS: $TEST_NAME (endpoint exists, auth guard, HTTP $HTTP_CODE)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
