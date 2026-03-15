#!/bin/bash
# PIPELINE: Ingérer une URL web pour disque-de-frein (ACTIF — déclenche ingestion réelle)
# ⚠️ Ce test déclenche une vraie ingestion Docker
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="pipeline/ingest-web-url"

# URL d'une page technique automobile réelle (freinage)
# On utilise force=true pour bypasser le dedup
RESPONSE=$(curl -s -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/rag/admin/ingest/web/single" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.automecanik.com/pieces/disque-de-frein-82.html",
    "truthLevel": "L2",
    "force": true
  }')
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/rag/admin/ingest/web/single" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.automecanik.com/pieces/disque-de-frein-82.html","truthLevel":"L2","force":true}')

JOB_ID=$(echo "$RESPONSE" | jq -r '.jobId // .data.jobId // "null"' 2>/dev/null)

if [ "$HTTP_CODE" = "202" ] || [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "PASS: $TEST_NAME (HTTP $HTTP_CODE, jobId=$JOB_ID)"
  # Sauvegarder le jobId pour P02
  echo "$JOB_ID" > "$(dirname "$0")/.last-web-job-id"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
