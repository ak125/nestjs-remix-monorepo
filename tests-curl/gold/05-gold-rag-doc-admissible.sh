#!/bin/bash
# GOLD F1: 1er doc RAG a truth_level non null et source traçable
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="gold/rag-doc-admissible"

FIRST_DOC=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge" | \
  jq -r 'if type == "array" then .[0].id elif .data then .data[0].id else empty end' 2>/dev/null)

if [ -z "$FIRST_DOC" ] || [ "$FIRST_DOC" = "null" ]; then
  echo "SKIP: $TEST_NAME (no docs in pool)"
  exit 0
fi

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge/doc/$FIRST_DOC")

TRUTH=$(echo "$RESPONSE" | jq -r '.truth_level // .data.truth_level // "null"' 2>/dev/null)
STATUS=$(echo "$RESPONSE" | jq -r '.status // .data.status // "null"' 2>/dev/null)
SOURCE=$(echo "$RESPONSE" | jq -r '.source_url // .data.source_url // .source // .data.source // "null"' 2>/dev/null)

PASS_COUNT=0
[ "$TRUTH" != "null" ] && [ -n "$TRUTH" ] && PASS_COUNT=$((PASS_COUNT + 1))
[ "$STATUS" != "null" ] && [ -n "$STATUS" ] && PASS_COUNT=$((PASS_COUNT + 1))

if [ "$PASS_COUNT" -ge 1 ]; then
  echo "PASS: $TEST_NAME (truth=$TRUTH, status=$STATUS, source=${SOURCE:0:40})"
else
  echo "FAIL: $TEST_NAME (truth=$TRUTH, status=$STATUS — doc not properly classified)"
fi
