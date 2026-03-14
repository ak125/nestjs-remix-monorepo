#!/bin/bash
# RAG: intent routing stats
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="rag/intent-stats"

RESPONSE=$(curl -s "$BASE_URL/api/rag/intents/stats")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/rag/intents/stats")

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
