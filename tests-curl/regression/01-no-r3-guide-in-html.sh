#!/bin/bash
# Regression: R3_guide ne doit pas apparaître comme vérité métier dans le HTML public
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="regression/no-r3-guide-in-html"

# Vérifie que la page gamme ne contient pas "R3_guide" dans le HTML visible
RESPONSE=$(curl -s "$BASE_URL/pieces/disque-de-frein-82.html")
R3_GUIDE_COUNT=$(echo "$RESPONSE" | grep -ci "R3_guide" 2>/dev/null)

if [ "$R3_GUIDE_COUNT" = "0" ] || [ -z "$R3_GUIDE_COUNT" ]; then
  echo "PASS: $TEST_NAME (0 occurrences)"
else
  echo "FAIL: $TEST_NAME ($R3_GUIDE_COUNT occurrences of R3_guide in HTML)"
fi
