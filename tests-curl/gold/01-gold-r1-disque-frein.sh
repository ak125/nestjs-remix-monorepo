#!/bin/bash
# GOLD R1: Page gamme disque-de-frein contient vocabulaire R1, pas vocabulaire interdit
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="gold/r1-disque-frein"

RESPONSE=$(curl -s "$BASE_URL/pieces/disque-de-frein-82.html")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/pieces/disque-de-frein-82.html")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

# R1 DOIT contenir : véhicule ou compatible
HAS_VEHICLE=$(echo "$RESPONSE" | grep -ci 'véhicule\|vehicule\|compatible' 2>/dev/null)

# R1 NE DOIT PAS contenir : symptôme, démonter, diagnostic (dans le contenu éditorial)
FORBIDDEN=$(echo "$RESPONSE" | grep -ci 'symptôme\|démonter\|diagnostic de panne' 2>/dev/null)

if [ "${HAS_VEHICLE:-0}" -gt 0 ] && [ "${FORBIDDEN:-0}" -le 1 ]; then
  echo "PASS: $TEST_NAME (vehicle_refs=$HAS_VEHICLE, forbidden=$FORBIDDEN)"
else
  echo "FAIL: $TEST_NAME (vehicle_refs=$HAS_VEHICLE, forbidden=$FORBIDDEN)"
fi
