#!/bin/bash
# PIPELINE: Vérifier pureté R1 post-refresh — vocabulaire interdit absent
BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="$(dirname "$0")/../.cookies"
TEST_NAME="pipeline/verify-purity-post-refresh"

RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/gammes-seo/82/detail")
SG_CONTENT=$(echo "$RESPONSE" | jq -r '.data.seo.sg_content // ""' 2>/dev/null)

if [ -z "$SG_CONTENT" ] || [ "$SG_CONTENT" = "" ]; then
  echo "SKIP: $TEST_NAME (sg_content empty)"
  exit 0
fi

# Nettoyer les liens <a> (maillage légitime)
CLEAN=$(echo "$SG_CONTENT" | sed 's|<a[^>]*>[^<]*</a>||g')

# Vocabulaire R3 interdit dans R1
R3_LEAK=$(echo "$CLEAN" | grep -ci 'démonter\|demonter\|remontage\|couple de serrage\|étape 1\|etape 1' 2>/dev/null)

# Vocabulaire R5 interdit dans R1
R5_LEAK=$(echo "$CLEAN" | grep -ci 'symptôme\|symptome\|panne potentielle\|voyant moteur\|code OBD' 2>/dev/null)

# Vocabulaire R6 interdit dans R1 (hors liens)
R6_LEAK=$(echo "$CLEAN" | grep -ci 'comment choisir\|meilleur rapport' 2>/dev/null)

TOTAL_LEAKS=$((${R3_LEAK:-0} + ${R5_LEAK:-0} + ${R6_LEAK:-0}))

if [ "$TOTAL_LEAKS" = "0" ]; then
  echo "PASS: $TEST_NAME (0 vocabulary leaks: R3=$R3_LEAK, R5=$R5_LEAK, R6=$R6_LEAK)"
else
  echo "FAIL: $TEST_NAME ($TOTAL_LEAKS leaks: R3=$R3_LEAK, R5=$R5_LEAK, R6=$R6_LEAK)"
fi
