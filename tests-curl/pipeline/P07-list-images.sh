#!/bin/bash
# PIPELINE: Lister images RAG (read-only, safe)
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="pipeline/list-images"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/images")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/images")

if [ "$HTTP_CODE" = "200" ]; then
  COUNT=$(echo "$RESPONSE" | jq 'if type == "array" then length elif .data then (.data | length) else 0 end' 2>/dev/null)
  echo "PASS: $TEST_NAME (HTTP 200, $COUNT images)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
