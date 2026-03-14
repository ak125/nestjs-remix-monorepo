#!/bin/bash
# Refresh T3: Draft SEO pour disque-de-frein (pg_id=82)
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="refresh/seo-draft-detail"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/seo-draft/82")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/seo-draft/82")

if [ "$HTTP_CODE" = "200" ]; then
  HAS_CONTENT=$(echo "$RESPONSE" | jq 'length > 0' 2>/dev/null)
  echo "PASS: $TEST_NAME (has_data=$HAS_CONTENT)"
elif [ "$HTTP_CODE" = "404" ]; then
  echo "PASS: $TEST_NAME (no draft for pg_id=82 — normal if not refreshed recently)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
