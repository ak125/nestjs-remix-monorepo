#!/bin/bash
# GOLD R6: Données guide achat pour disque-de-frein, pas de vocabulaire R5
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="gold/r6-guide-data"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

# Vérifie présence de données guide achat
HAS_GUIDE=$(echo "$RESPONSE" | jq '.data.articles // .data.conseils // [] | length' 2>/dev/null)
GAMME_NAME=$(echo "$RESPONSE" | jq -r '.data.gamme.pg_alias // .data.gamme.pg_name // "unknown"' 2>/dev/null)

if [ "${HAS_GUIDE:-0}" -ge 0 ] && [ "$GAMME_NAME" != "null" ] && [ -n "$GAMME_NAME" ]; then
  echo "PASS: $TEST_NAME (gamme=$GAMME_NAME, articles/conseils=$HAS_GUIDE)"
else
  echo "FAIL: $TEST_NAME (missing guide data)"
fi
