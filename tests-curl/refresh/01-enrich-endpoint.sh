#!/bin/bash
# Refresh: endpoint enrichissement accessible (dry-run check)
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="refresh/enrich-endpoint"

# On vérifie juste que l'endpoint existe et répond (pas de trigger réel)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/admin/rag-ingest/force-enrich" \
  -H "Content-Type: application/json" \
  -d '{"pgAlias":"__test_nonexistent__"}')

# 400/404 = endpoint existe, input invalide = OK
# 401/403 = auth problem
# 500+ = server error
if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "PASS: $TEST_NAME (endpoint responds, HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "FAIL: $TEST_NAME (auth required — run 00-auth.sh first)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
