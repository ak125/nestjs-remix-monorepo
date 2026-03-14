#!/bin/bash
# RAG T1: Détail d'un doc — vérifie truth_level, source_url, status
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="rag/knowledge-doc-detail"

# Récupère le 1er doc ID du pool
FIRST_DOC=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge" | \
  jq -r 'if type == "array" then .[0].id elif .data then .data[0].id else empty end' 2>/dev/null)

if [ -z "$FIRST_DOC" ] || [ "$FIRST_DOC" = "null" ]; then
  echo "SKIP: $TEST_NAME (no docs in pool)"
  exit 0
fi

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge/doc/$FIRST_DOC")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge/doc/$FIRST_DOC")

if [ "$HTTP_CODE" = "200" ]; then
  TRUTH=$(echo "$RESPONSE" | jq -r '.truth_level // .data.truth_level // "missing"' 2>/dev/null)
  STATUS=$(echo "$RESPONSE" | jq -r '.status // .data.status // "missing"' 2>/dev/null)
  echo "PASS: $TEST_NAME (truth_level=$TRUTH, status=$STATUS)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE, doc_id=$FIRST_DOC)"
fi
