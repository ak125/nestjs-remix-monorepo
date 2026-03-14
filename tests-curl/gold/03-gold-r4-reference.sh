#!/bin/bash
# GOLD R4: Page référence disque-de-frein contient définition, pas how-to
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="gold/r4-reference"

RESPONSE=$(curl -s "$BASE_URL/reference-auto/disque-de-frein")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/reference-auto/disque-de-frein")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

# R4 DOIT contenir du contenu encyclopédique
HAS_DEFINITION=$(echo "$RESPONSE" | grep -ci 'définition\|definition\|rôle\|role\|composition\|mécanique\|mecanique' 2>/dev/null)

# R4 NE DOIT PAS contenir de procédure détaillée
HOWTO=$(echo "$RESPONSE" | grep -ci 'étape 1\|etape 1\|démonter\|demonter\|couple de serrage' 2>/dev/null)

if [ "${HAS_DEFINITION:-0}" -gt 0 ] && [ "${HOWTO:-0}" -le 1 ]; then
  echo "PASS: $TEST_NAME (definition_refs=$HAS_DEFINITION, howto_leaks=$HOWTO)"
else
  echo "FAIL: $TEST_NAME (definition_refs=$HAS_DEFINITION, howto_leaks=$HOWTO)"
fi
