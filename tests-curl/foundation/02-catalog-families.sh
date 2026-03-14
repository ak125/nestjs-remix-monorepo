#!/bin/bash
# Vérifie que le catalogue retourne des familles
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="foundation/catalog-families"

RESPONSE=$(curl -s "$BASE_URL/api/catalog/families")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/catalog/families")
COUNT=$(echo "$RESPONSE" | jq 'if type == "array" then length elif .data then (.data | length) else 0 end' 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME (HTTP 200, count=$COUNT)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
