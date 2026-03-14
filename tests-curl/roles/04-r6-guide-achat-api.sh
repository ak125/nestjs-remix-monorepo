#!/bin/bash
# R6: API guide achat retourne des données pour une gamme
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="roles/r6-guide-achat-api"

RESPONSE=$(curl -s "$BASE_URL/api/blog/article/by-gamme/disque-de-frein")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/blog/article/by-gamme/disque-de-frein")

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
