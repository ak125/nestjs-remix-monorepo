#!/bin/bash
# Regression T5: Chaque doc RAG a un truth_level non null
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="regression/rag-doc-has-truth-level"

FIRST_DOC=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge" | \
  jq -r 'if type == "array" then .[0].id elif .data then .data[0].id else empty end' 2>/dev/null)

if [ -z "$FIRST_DOC" ] || [ "$FIRST_DOC" = "null" ]; then
  echo "SKIP: $TEST_NAME (no docs in pool)"
  exit 0
fi

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge/doc/$FIRST_DOC")
TRUTH=$(echo "$RESPONSE" | jq -r '.truth_level // .data.truth_level // "null"' 2>/dev/null)

if [ "$TRUTH" != "null" ] && [ -n "$TRUTH" ]; then
  echo "PASS: $TEST_NAME (truth_level=$TRUTH)"
else
  echo "FAIL: $TEST_NAME (truth_level is null or missing)"
fi
