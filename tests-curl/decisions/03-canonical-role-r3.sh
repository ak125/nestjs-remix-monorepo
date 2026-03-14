#!/bin/bash
# DECISION: API conseil ne retourne PAS R3_guide comme canonical_role
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="decision/canonical-role-r3-not-guide"

RESPONSE=$(curl -s "$BASE_URL/api/blog/conseil/82")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/blog/conseil/82")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

# Vérifie que la réponse ne contient pas "R3_guide" comme rôle canonique
R3_GUIDE_COUNT=$(echo "$RESPONSE" | jq 'tostring' 2>/dev/null | grep -ci '"R3_guide"' 2>/dev/null)

if [ "${R3_GUIDE_COUNT:-0}" = "0" ]; then
  echo "PASS: $TEST_NAME (no R3_guide in response)"
else
  echo "FAIL: $TEST_NAME ($R3_GUIDE_COUNT occurrences of R3_guide in conseil API)"
fi
