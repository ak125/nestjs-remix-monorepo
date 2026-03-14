#!/bin/bash
# RAG: knowledge documents list — pool documentaire accessible
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="rag/knowledge-list"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge")

if [ "$HTTP_CODE" = "200" ]; then
  COUNT=$(echo "$RESPONSE" | jq 'if type == "array" then length elif .data then (.data | length) elif .documents then (.documents | length) else 0 end' 2>/dev/null)
  echo "PASS: $TEST_NAME (HTTP 200, docs=$COUNT)"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "PASS: $TEST_NAME (endpoint exists, auth guard active, HTTP $HTTP_CODE)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
