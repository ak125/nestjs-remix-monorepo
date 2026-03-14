#!/bin/bash
# Run all curl smoke tests
# Usage: ./tests-curl/run-all.sh [BASE_URL]

export BASE_URL="${1:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0
SKIP=0

echo "========================================"
echo "  Smoke Tests — $BASE_URL"
echo "========================================"
echo ""

# Auth first
echo "--- Auth ---"
bash "$SCRIPT_DIR/00-auth.sh"
AUTH_RESULT=$?
if [ $AUTH_RESULT -ne 0 ]; then
  echo "Auth failed — admin tests will fail"
fi
echo ""

# Run each directory
for DIR in foundation roles refresh qa rag decisions gold contra regression; do
  echo "--- $DIR ---"
  for f in "$SCRIPT_DIR/$DIR"/*.sh; do
    [ -f "$f" ] || continue
    OUTPUT=$(bash "$f" 2>&1)
    echo "$OUTPUT"
    if echo "$OUTPUT" | grep -q "^PASS"; then
      PASS=$((PASS + 1))
    elif echo "$OUTPUT" | grep -q "^SKIP"; then
      SKIP=$((SKIP + 1))
    else
      FAIL=$((FAIL + 1))
    fi
  done
  echo ""
done

echo "========================================"
echo "  Results: $PASS PASS, $FAIL FAIL, $SKIP SKIP"
echo "========================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
