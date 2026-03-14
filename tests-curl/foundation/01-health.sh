#!/bin/bash
# Vérifie que le serveur répond
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="foundation/health"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
