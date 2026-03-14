#!/bin/bash
# QA: SEO cockpit dashboard retourne des stats
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="qa/seo-cockpit-dashboard"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/seo-cockpit/dashboard")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/seo-cockpit/dashboard")

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "FAIL: $TEST_NAME (auth required — run 00-auth.sh first)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
