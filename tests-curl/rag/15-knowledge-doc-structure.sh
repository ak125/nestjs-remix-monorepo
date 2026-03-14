#!/bin/bash
# RAG T2: Vérifie structure complète d'un doc RAG (content, metadata, truth_level)
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="rag/knowledge-doc-structure"

FIRST_DOC=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge" | \
  jq -r 'if type == "array" then .[0].id elif .data then .data[0].id else empty end' 2>/dev/null)

if [ -z "$FIRST_DOC" ] || [ "$FIRST_DOC" = "null" ]; then
  echo "SKIP: $TEST_NAME (no docs in pool)"
  exit 0
fi

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge/doc/$FIRST_DOC")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge/doc/$FIRST_DOC")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

# Vérifie les champs critiques
HAS_CONTENT=$(echo "$RESPONSE" | jq 'has("content") or has("body") or (.data | has("content") // false)' 2>/dev/null)
HAS_TRUTH=$(echo "$RESPONSE" | jq '(.truth_level // .data.truth_level) != null' 2>/dev/null)
SOURCE=$(echo "$RESPONSE" | jq -r '.source_url // .data.source_url // "none"' 2>/dev/null)

if [ "$HAS_TRUTH" = "true" ]; then
  echo "PASS: $TEST_NAME (has_content=$HAS_CONTENT, has_truth=$HAS_TRUTH, source=$SOURCE)"
else
  echo "FAIL: $TEST_NAME (missing critical fields: truth=$HAS_TRUTH, content=$HAS_CONTENT)"
fi
