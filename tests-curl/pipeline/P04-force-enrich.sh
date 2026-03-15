#!/bin/bash
# PIPELINE: Force-enrich disque-de-frein (ACTIF — déclenche un refresh réel)
# ⚠️ Ce test déclenche une vraie régénération du contenu
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="pipeline/force-enrich"

echo "⚠️  $TEST_NAME: déclenche un refresh réel pour disque-de-frein..."

RESPONSE=$(curl -s -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/admin/rag/pdf-merge/force-enrich" \
  -H "Content-Type: application/json" \
  -d '{"pgAlias":"disque-de-frein"}')
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/admin/rag/pdf-merge/force-enrich" \
  -H "Content-Type: application/json" \
  -d '{"pgAlias":"disque-de-frein"}')

STATUS=$(echo "$RESPONSE" | jq -r '.status // .data.status // "unknown"' 2>/dev/null)
QUEUED=$(echo "$RESPONSE" | jq -r '.queuedPageTypes // .data.queuedPageTypes // [] | length' 2>/dev/null)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "PASS: $TEST_NAME (HTTP $HTTP_CODE, status=$STATUS, queued=$QUEUED page types)"
elif [ "$HTTP_CODE" = "404" ]; then
  echo "WARN: $TEST_NAME (HTTP 404 — gamme not found or no RAG docs)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
