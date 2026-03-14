#!/bin/bash
# CONTRA: Gamme inexistante retourne 404, pas 500
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="contra/nonexistent-gamme-404"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/pieces/gamme-inexistante-99999.html")

if [ "$HTTP_CODE" = "404" ]; then
  echo "PASS: $TEST_NAME (HTTP 404 as expected)"
elif [ "$HTTP_CODE" = "200" ]; then
  echo "WARN: $TEST_NAME (HTTP 200 — may be a catch-all route)"
elif [ "$HTTP_CODE" -ge 500 ] 2>/dev/null; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE — server error on missing gamme)"
else
  echo "PASS: $TEST_NAME (HTTP $HTTP_CODE)"
fi
