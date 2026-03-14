#!/bin/bash
# DECISION: QA gate retourne des champs protégés structurés
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="decision/qa-gate-fields"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/qa-gate")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/qa-gate")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

# Vérifie que la réponse a une structure exploitable (pas juste un 200 vide)
SIZE=$(echo "$RESPONSE" | jq 'if type == "array" then length elif type == "object" then (keys | length) else 0 end' 2>/dev/null)

if [ "${SIZE:-0}" -gt 0 ] 2>/dev/null; then
  echo "PASS: $TEST_NAME (structured response, $SIZE entries/keys)"
else
  echo "FAIL: $TEST_NAME (empty or unstructured response)"
fi
