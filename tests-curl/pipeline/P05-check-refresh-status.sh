#!/bin/bash
# PIPELINE: Vérifier que le contenu SEO existe pour pg_id=82 après refresh
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="pipeline/check-refresh-status"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

SG_CONTENT_LEN=$(echo "$RESPONSE" | jq -r '.data.seo.sg_content // ""' 2>/dev/null | wc -c)
SG_H1=$(echo "$RESPONSE" | jq -r '.data.seo.sg_h1 // ""' 2>/dev/null)

if [ "$SG_CONTENT_LEN" -gt 100 ] 2>/dev/null && [ -n "$SG_H1" ] && [ "$SG_H1" != "null" ]; then
  echo "PASS: $TEST_NAME (content=${SG_CONTENT_LEN}c, h1='${SG_H1:0:40}...')"
else
  echo "FAIL: $TEST_NAME (content=${SG_CONTENT_LEN}c, h1=$SG_H1)"
fi
