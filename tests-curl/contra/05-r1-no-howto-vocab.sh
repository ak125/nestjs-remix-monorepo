#!/bin/bash
# CONTRA: sg_content R1 ne contient pas de vocabulaire how-to R3
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="contra/r1-no-howto-vocab"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")
SG_CONTENT=$(echo "$RESPONSE" | jq -r '.data.seo.sg_content // ""' 2>/dev/null)

if [ -z "$SG_CONTENT" ] || [ "$SG_CONTENT" = "" ]; then
  echo "SKIP: $TEST_NAME (sg_content empty)"
  exit 0
fi

# Vocabulaire interdit R3 dans contenu R1
HOWTO_COUNT=$(echo "$SG_CONTENT" | grep -ci 'démonter\|demonter\|étape 1\|etape 1\|couple de serrage\|remontage\|pas-à-pas\|pas a pas' 2>/dev/null)

if [ "${HOWTO_COUNT:-0}" = "0" ]; then
  echo "PASS: $TEST_NAME (0 how-to terms in R1 content)"
else
  echo "FAIL: $TEST_NAME ($HOWTO_COUNT how-to terms leaked into R1 content)"
fi
