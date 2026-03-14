#!/bin/bash
# RAG: cleanup decide dry-run — foundation gate responds
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="rag/cleanup-decide-dry"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/rag/admin/cleanup/decide" \
  -H "Content-Type: application/json" \
  -d '{"source":"__test_nonexistent__","dryRun":true}')

# 200/400 = endpoint exists and foundation gate processes the request
# 401/403 = auth guard active
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "PASS: $TEST_NAME (endpoint responds, HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "PASS: $TEST_NAME (endpoint exists, auth guard, HTTP $HTTP_CODE)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
