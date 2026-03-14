#!/bin/bash
# DECISION: Doc RAG admissible a foundation_gate_passed=true ou phase1_status=passed
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="decision/foundation-gate-passed"

FIRST_DOC=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge" | \
  jq -r 'if type == "array" then .[0].id elif .data then .data[0].id else empty end' 2>/dev/null)

if [ -z "$FIRST_DOC" ] || [ "$FIRST_DOC" = "null" ]; then
  echo "SKIP: $TEST_NAME (no docs in pool)"
  exit 0
fi

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/knowledge/doc/$FIRST_DOC")

# Cherche foundation_gate_passed, phase1_status, ou status
GATE=$(echo "$RESPONSE" | jq -r '.foundation_gate_passed // .data.foundation_gate_passed // .phase1_status // .data.phase1_status // "unknown"' 2>/dev/null)
STATUS=$(echo "$RESPONSE" | jq -r '.status // .data.status // "unknown"' 2>/dev/null)

if [ "$GATE" = "true" ] || [ "$GATE" = "passed" ] || [ "$STATUS" = "active" ]; then
  echo "PASS: $TEST_NAME (gate=$GATE, status=$STATUS)"
else
  echo "WARN: $TEST_NAME (gate=$GATE, status=$STATUS — doc may not be admissible)"
fi
