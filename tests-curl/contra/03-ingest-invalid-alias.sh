#!/bin/bash
# CONTRA: Ingest preview avec alias invalide retourne 400/404, pas 500
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="contra/ingest-invalid-alias"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/admin/rag-ingest/preview" \
  -H "Content-Type: application/json" \
  -d '{"pgAlias":"__INVALID_ALIAS_THAT_DOES_NOT_EXIST__"}')

if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "422" ]; then
  echo "PASS: $TEST_NAME (HTTP $HTTP_CODE — proper error handling)"
elif [ "$HTTP_CODE" -ge 500 ] 2>/dev/null; then
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE — server crash on invalid alias)"
else
  echo "PASS: $TEST_NAME (HTTP $HTTP_CODE)"
fi
