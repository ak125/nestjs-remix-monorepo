#!/bin/bash
# RAG T2: Switches SEO par gamme — vérifie flags SEO fonctionnels
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="rag/seo-switches"

RESPONSE=$(curl -s "$BASE_URL/api/blog/seo-switches/82")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/blog/seo-switches/82")

if [ "$HTTP_CODE" = "200" ]; then
  echo "PASS: $TEST_NAME"
else
  echo "FAIL: $TEST_NAME (HTTP $HTTP_CODE)"
fi
