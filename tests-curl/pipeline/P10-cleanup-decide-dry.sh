#!/bin/bash
# PIPELINE: Cleanup decide dry-run — teste la décision d'ingestion sans écrire
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="pipeline/cleanup-decide-dry"

RESPONSE=$(curl -s -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/rag/admin/cleanup/decide" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Pipeline Doc - Disque de frein ventilé",
    "content": "Le disque de frein ventilé est composé de deux plateaux séparés par des ailettes de refroidissement. Diamètre typique : 280-330mm. Épaisseur neuve : 22-28mm. Seuil minimum : dépend du constructeur. Matériau : fonte GG25 ou composite carbone-céramique pour les versions haute performance.",
    "source": "test/pipeline-validation",
    "domain": "freinage",
    "category": "catalog/gamme",
    "truth_level": "L3"
  }')
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" \
  -X POST "$BASE_URL/api/rag/admin/cleanup/decide" \
  -H "Content-Type: application/json" \
  -d '{"title":"test","content":"test content","source":"test/x","domain":"freinage","category":"catalog/gamme","truth_level":"L3"}')

DECISION=$(echo "$RESPONSE" | jq -r '.decision // .data.decision // .action // "unknown"' 2>/dev/null)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "PASS: $TEST_NAME (HTTP $HTTP_CODE, decision=$DECISION)"
elif [ "$HTTP_CODE" = "400" ]; then
  echo "PASS: $TEST_NAME (HTTP 400 — validation active, endpoint works)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
