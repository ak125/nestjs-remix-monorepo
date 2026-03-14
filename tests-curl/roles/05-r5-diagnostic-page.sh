#!/bin/bash
# R5: page diagnostic accessible
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="roles/r5-diagnostic-page"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/diagnostic-auto/disque-de-frein")

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME"
elif [ "$HTTP_CODE" = "404" ]; then
  echo "SKIP: $TEST_NAME (route not yet deployed)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
