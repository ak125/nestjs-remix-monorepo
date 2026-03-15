#!/bin/bash
# PIPELINE: Vérifier qu'il existe des docs RAG pour disque-de-frein (read-only)
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="pipeline/verify-rag-doc"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge")

# Chercher des docs avec gamme_aliases contenant disque-de-frein
MATCHING=$(echo "$RESPONSE" | jq '[if type == "array" then .[] elif .data then .data[] else empty end | select(.gamme_aliases != null) | select(.gamme_aliases | tostring | contains("disque-de-frein"))] | length' 2>/dev/null)

if [ "${MATCHING:-0}" -gt 0 ] 2>/dev/null; then
  echo "PASS: $TEST_NAME ($MATCHING docs RAG pour disque-de-frein)"
else
  echo "FAIL: $TEST_NAME (0 docs RAG pour disque-de-frein dans le pool)"
fi
