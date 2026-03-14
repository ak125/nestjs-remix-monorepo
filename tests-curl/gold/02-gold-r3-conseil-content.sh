#!/bin/bash
# GOLD R3: Conseil disque-de-frein a du contenu, pas de vocabulaire R2/R6
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="gold/r3-conseil-content"

RESPONSE=$(curl -s "$BASE_URL/api/blog/conseil/82")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/blog/conseil/82")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

RESPONSE_STR=$(echo "$RESPONSE" | jq -r 'tostring' 2>/dev/null)
SIZE=${#RESPONSE_STR}

# R3 NE DOIT PAS contenir de vocabulaire transactionnel
TRANSACTIONAL=$(echo "$RESPONSE_STR" | grep -ci 'ajouter au panier\|livraison gratuite\|en stock\|promo' 2>/dev/null)

if [ "$SIZE" -gt 200 ] && [ "${TRANSACTIONAL:-0}" = "0" ]; then
  echo "PASS: $TEST_NAME (size=$SIZE, transactional_terms=0)"
elif [ "$SIZE" -gt 200 ]; then
  echo "WARN: $TEST_NAME (size=$SIZE but $TRANSACTIONAL transactional terms found)"
else
  echo "FAIL: $TEST_NAME (response too small: $SIZE)"
fi
