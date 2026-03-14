#!/bin/bash
# R3: article conseil accessible
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="roles/r3-conseil-article"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/blog/conseil/82")

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
