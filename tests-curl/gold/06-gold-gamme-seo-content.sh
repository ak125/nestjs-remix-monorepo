#!/bin/bash
# GOLD SEO: Gamme pg_id=82 a sg_content, sg_h1, sg_title, sg_descrip tous non vides
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="gold/gamme-seo-content"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

SG_CONTENT_LEN=$(echo "$RESPONSE" | jq -r '.data.seo.sg_content // ""' 2>/dev/null | wc -c)
SG_H1=$(echo "$RESPONSE" | jq -r '.data.seo.sg_h1 // ""' 2>/dev/null)
SG_TITLE=$(echo "$RESPONSE" | jq -r '.data.seo.sg_title // ""' 2>/dev/null)
SG_DESCRIP=$(echo "$RESPONSE" | jq -r '.data.seo.sg_descrip // ""' 2>/dev/null)

PASS_COUNT=0
[ "$SG_CONTENT_LEN" -gt 100 ] 2>/dev/null && PASS_COUNT=$((PASS_COUNT + 1))
[ -n "$SG_H1" ] && [ "$SG_H1" != "" ] && [ "$SG_H1" != "null" ] && PASS_COUNT=$((PASS_COUNT + 1))
[ -n "$SG_TITLE" ] && [ "$SG_TITLE" != "" ] && [ "$SG_TITLE" != "null" ] && PASS_COUNT=$((PASS_COUNT + 1))
[ -n "$SG_DESCRIP" ] && [ "$SG_DESCRIP" != "" ] && [ "$SG_DESCRIP" != "null" ] && PASS_COUNT=$((PASS_COUNT + 1))

if [ "$PASS_COUNT" -ge 4 ]; then
  echo "PASS: $TEST_NAME (4/4 SEO fields present: content=${SG_CONTENT_LEN}c, h1='${SG_H1:0:30}...')"
elif [ "$PASS_COUNT" -ge 2 ]; then
  echo "WARN: $TEST_NAME ($PASS_COUNT/4 SEO fields present)"
else
  echo "FAIL: $TEST_NAME ($PASS_COUNT/4 SEO fields present)"
fi
