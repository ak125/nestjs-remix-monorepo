#!/bin/bash
# RAG: service health check
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="rag/health"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/rag/health")

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME"
elif [ "$HTTP_CODE" = "503" ]; then
  echo "SKIP: $TEST_NAME (RAG service unavailable)"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
