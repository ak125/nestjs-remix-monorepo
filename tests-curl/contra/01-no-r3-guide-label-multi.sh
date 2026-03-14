#!/bin/bash
# CONTRA: R3_guide ne doit pas apparaître dans HTML public (3 pages)
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_NAME="contra/no-r3-guide-label-multi"
TOTAL_FOUND=0

for URL in \
  "/pieces/disque-de-frein-82.html" \
  "/reference-auto/disque-de-frein" \
  "/blog-pieces-auto/disque-de-frein"; do
  RESPONSE=$(curl -s "$BASE_URL$URL" 2>/dev/null)
  COUNT=$(echo "$RESPONSE" | grep -ci 'R3_guide' 2>/dev/null)
  TOTAL_FOUND=$((TOTAL_FOUND + ${COUNT:-0}))
done

if [ "$TOTAL_FOUND" = "0" ]; then
  echo "PASS: $TEST_NAME (0 R3_guide across 3 public pages)"
else
  echo "FAIL: $TEST_NAME ($TOTAL_FOUND R3_guide found across public pages)"
fi
