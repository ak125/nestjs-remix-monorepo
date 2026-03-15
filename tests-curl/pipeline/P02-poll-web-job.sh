#!/bin/bash
# PIPELINE: Poll le status du dernier job web jusqu'à completion
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="pipeline/poll-web-job"

JOB_ID_FILE="$(dirname "$0")/.last-web-job-id"
if [ ! -f "$JOB_ID_FILE" ]; then
  echo "SKIP: $TEST_NAME (no job ID — run P01 first)"
  exit 0
fi

JOB_ID=$(cat "$JOB_ID_FILE")
if [ "$JOB_ID" = "null" ] || [ -z "$JOB_ID" ]; then
  echo "SKIP: $TEST_NAME (job ID is null)"
  exit 0
fi

MAX_WAIT=60
INTERVAL=5
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/rag/admin/ingest/web/jobs/$JOB_ID")
  STATUS=$(echo "$RESPONSE" | jq -r '.status // .data.status // "unknown"' 2>/dev/null)

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "finished" ] || [ "$STATUS" = "done" ]; then
    echo "PASS: $TEST_NAME (status=$STATUS after ${ELAPSED}s)"
    exit 0
  elif [ "$STATUS" = "failed" ] || [ "$STATUS" = "error" ]; then
    ERROR=$(echo "$RESPONSE" | jq -r '.errorMessage // .error // "unknown"' 2>/dev/null)
    echo "FAIL: $TEST_NAME (status=$STATUS, error=$ERROR)"
    exit 1
  fi

  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "WARN: $TEST_NAME (timeout ${MAX_WAIT}s, last status=$STATUS)"
