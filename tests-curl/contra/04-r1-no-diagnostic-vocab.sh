#!/bin/bash
# CONTRA: sg_content R1 ne contient pas de vocabulaire diagnostic R5
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="contra/r1-no-diagnostic-vocab"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")
SG_CONTENT=$(echo "$RESPONSE" | jq -r '.data.seo.sg_content // ""' 2>/dev/null)

if [ -z "$SG_CONTENT" ] || [ "$SG_CONTENT" = "" ]; then
  echo "SKIP: $TEST_NAME (sg_content empty)"
  exit 0
fi

# Vocabulaire interdit R5 dans contenu R1 (exclure les liens cross-rôle href)
# Les liens vers /diagnostic-auto/ sont légitimes (maillage R1→R5)
CLEAN_CONTENT=$(echo "$SG_CONTENT" | sed 's|href="[^"]*"||g' | sed 's|/diagnostic-auto/[^ <]*||g')
DIAG_COUNT=$(echo "$CLEAN_CONTENT" | grep -ci 'symptôme\|symptome\|panne potentielle\|diagnostic de panne\|code OBD\|code DTC\|voyant moteur' 2>/dev/null)

if [ "${DIAG_COUNT:-0}" = "0" ]; then
  echo "PASS: $TEST_NAME (0 diagnostic terms in R1 content)"
else
  echo "FAIL: $TEST_NAME ($DIAG_COUNT diagnostic terms leaked into R1 content)"
fi
