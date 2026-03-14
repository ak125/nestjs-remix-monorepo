#!/bin/bash
# Regression T5: Contenu gamme réellement présent (sg_content non vide)
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="regression/gamme-detail-has-content"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

# Vérifie sg_content non vide
SG_CONTENT=$(echo "$RESPONSE" | jq -r '.data.seo.sg_content // .sg_content // .data.sg_content // ""' 2>/dev/null)
CONTENT_LEN=${#SG_CONTENT}

if [ "$CONTENT_LEN" -gt 50 ] 2>/dev/null; then
  echo "PASS: $TEST_NAME (sg_content=$CONTENT_LEN chars)"
else
  echo "FAIL: $TEST_NAME (sg_content too short: $CONTENT_LEN chars)"
fi
