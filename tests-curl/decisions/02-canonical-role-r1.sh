#!/bin/bash
# DECISION: Gamme detail contient un rôle R1/router dans ses données
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="decision/canonical-role-r1"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

# Vérifie que la gamme a des données SEO (sg_h1, sg_content = R1 content)
SG_H1=$(echo "$RESPONSE" | jq -r '.data.seo.sg_h1 // ""' 2>/dev/null)
SG_TITLE=$(echo "$RESPONSE" | jq -r '.data.seo.sg_title // ""' 2>/dev/null)

if [ -n "$SG_H1" ] && [ "$SG_H1" != "null" ] && [ ${#SG_H1} -gt 5 ]; then
  echo "PASS: $TEST_NAME (sg_h1='${SG_H1:0:60}...')"
else
  echo "FAIL: $TEST_NAME (sg_h1 missing or empty)"
fi
