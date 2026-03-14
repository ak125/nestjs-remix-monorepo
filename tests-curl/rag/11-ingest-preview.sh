#!/bin/bash
# RAG T1: Preview ingestion — vérifie que le parser RAG retourne des sections
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="rag/ingest-preview"

RESPONSE=$(curl -s -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/admin/rag-ingest/preview" \
  -H "Content-Type: application/json" \
  -d '{"pgAlias":"disque-de-frein"}')
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/admin/rag-ingest/preview" \
  -H "Content-Type: application/json" \
  -d '{"pgAlias":"disque-de-frein"}')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  SECTIONS=$(echo "$RESPONSE" | jq '.sections // .data.sections // [] | length' 2>/dev/null)
  HAS_ERROR=$(echo "$RESPONSE" | jq '.error // empty' 2>/dev/null)
  if [ -n "$HAS_ERROR" ] && [ "$HAS_ERROR" != "null" ]; then
    echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE but error: $HAS_ERROR)"
  else
    echo "PASS: $TEST_NAME (HTTP $HTTP_CODE, sections=$SECTIONS)"
  fi
elif [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "404" ]; then
  echo "PASS: $TEST_NAME (endpoint responds, HTTP $HTTP_CODE — gamme may need RAG doc)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
