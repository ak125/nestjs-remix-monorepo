#!/bin/bash
# R4: fiche référence accessible
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="roles/r4-reference"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/reference-auto/disque-de-frein")

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
