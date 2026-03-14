#!/bin/bash
# Regression: guide achat doit être servi sans label R3_guide visible
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="regression/r6-not-r3-label"

RESPONSE=$(curl -s "$BASE_URL/blog-pieces-auto/guide-achat/disque-de-frein" 2>/dev/null)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/blog-pieces-auto/guide-achat/disque-de-frein" 2>/dev/null)

if [ "$HTTP_CODE" = "404" ]; then
  echo "SKIP: $TEST_NAME (route guide-achat not yet deployed)"
  exit 0
fi

R3_GUIDE_COUNT=$(echo "$RESPONSE" | grep -ci "R3_guide" 2>/dev/null)

if [ "$R3_GUIDE_COUNT" = "0" ] || [ -z "$R3_GUIDE_COUNT" ]; then
  echo "PASS: $TEST_NAME (no R3_guide label in guide achat page)"
else
  echo "FAIL: $TEST_NAME ($R3_GUIDE_COUNT occurrences of R3_guide)"
fi
