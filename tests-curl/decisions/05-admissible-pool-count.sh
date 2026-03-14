#!/bin/bash
# DECISION: Pool RAG admissible contient >0 docs avec truth_level non null
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="decision/admissible-pool-count"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge")

# Compte les docs avec truth_level non null et non vide (= admissibles)
# Note: l'API defaulte truth_level à 'L3' si absent, donc on vérifie juste la présence
ADMISSIBLE=$(echo "$RESPONSE" | jq '[if type == "array" then .[] elif .data then .data[] else empty end | select(.truth_level != null and .truth_level != "")] | length' 2>/dev/null)
TOTAL=$(echo "$RESPONSE" | jq 'if type == "array" then length elif .data then (.data | length) else 0 end' 2>/dev/null)

if [ "${ADMISSIBLE:-0}" -gt 0 ] 2>/dev/null; then
  echo "PASS: $TEST_NAME ($ADMISSIBLE admissible / $TOTAL total)"
else
  echo "FAIL: $TEST_NAME (0 admissible docs in pool, total=$TOTAL)"
fi
