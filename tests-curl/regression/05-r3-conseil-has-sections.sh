#!/bin/bash
# Regression T5: Contenu R3 réellement généré (≥1 section non vide)
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="regression/r3-conseil-has-sections"

RESPONSE=$(curl -s "$BASE_URL/api/blog/conseil/82")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/blog/conseil/82")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

# Vérifie qu'il y a du contenu non vide
SIZE=$(echo "$RESPONSE" | jq 'tostring | length' 2>/dev/null)

if [ "${SIZE:-0}" -gt 100 ] 2>/dev/null; then
  echo "PASS: $TEST_NAME (response size=$SIZE bytes)"
else
  echo "FAIL: $TEST_NAME (response too small: $SIZE bytes — content may be empty)"
fi
