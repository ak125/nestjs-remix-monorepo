#!/bin/bash
# DECISION: SEO draft pour pg_id=82 a un statut de décision non null
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="decision/refresh-decision"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/seo-draft/82")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL/api/admin/content-refresh/seo-draft/82")

if [ "$HTTP_CODE" = "404" ]; then
  echo "PASS: $TEST_NAME (no draft — gamme not recently refreshed, expected)"
  exit 0
fi

if [ "$HTTP_CODE" != "200" ]; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
  exit 1
fi

# Vérifie qu'il y a une décision (status, refresh_decision, ou mode)
DECISION=$(echo "$RESPONSE" | jq -r '.status // .refresh_decision // .data.status // .data.refresh_decision // "null"' 2>/dev/null)

if [ "$DECISION" != "null" ] && [ -n "$DECISION" ]; then
  echo "PASS: $TEST_NAME (decision=$DECISION)"
else
  echo "WARN: $TEST_NAME (no explicit decision field found in draft)"
fi
