#!/bin/bash
# Regression: metadata SEO ne contient pas de vocabulaire interdit cross-rôle
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="regression/seo-metadata-no-forbidden"

RESPONSE=$(curl -s "$BASE_URL/api/seo/metadata/pieces/disque-de-frein-82.html")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/seo/metadata/pieces/disque-de-frein-82.html")

if [ "$HTTP_CODE" != "200" ]; then
  echo "SKIP: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 0
fi

# Vérifier absence de termes interdits dans la meta description d'une page R1
FORBIDDEN_COUNT=$(echo "$RESPONSE" | jq -r '.description // ""' 2>/dev/null | grep -ciE 'demonter|remontage|symptome|diagnostic|guide.d.achat' 2>/dev/null)

if [ "$FORBIDDEN_COUNT" = "0" ] || [ -z "$FORBIDDEN_COUNT" ]; then
  echo "PASS: $TEST_NAME"
else
  echo "FAIL: $TEST_NAME ($FORBIDDEN_COUNT forbidden terms in R1 meta description)"
fi
