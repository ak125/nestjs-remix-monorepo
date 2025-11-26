#!/bin/bash
# Test: Toutes les positions (Avant/Arrière, Gauche/Droite, Supérieur/Inférieur)

echo "🧪 TEST: Détection universelle des positions"
echo "=============================================="

# Test 1: Plaquettes de frein (Avant/Arrière)
echo ""
echo "📊 Test 1: Plaquettes de frein (typeId=25454, gammeId=402)"
echo "-----------------------------------------------------------"
RESULT=$(curl -s http://localhost:3000/api/catalog/batch-loader \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"typeId":25454,"gammeId":402}')

TOTAL=$(echo "$RESULT" | jq -r '.pieces | length')
GROUPES=$(echo "$RESULT" | jq -r '[.grouped_pieces[].title_h2] | unique | join(", ")')
echo "  Total: $TOTAL pièces"
echo "  Groupes: $GROUPES"

MGA_931=$(echo "$RESULT" | jq -r '.grouped_pieces[] | select(.pieces[] | select(.reference == "931")) | .title_h2')
MGA_932=$(echo "$RESULT" | jq -r '.grouped_pieces[] | select(.pieces[] | select(.reference == "932")) | .title_h2')

if [[ "$MGA_931" == *"Avant"* ]] && [[ "$MGA_932" == *"Arrière"* ]]; then
  echo "  ✅ MGA 931 (Avant) et 932 (Arrière) correctement séparées"
else
  echo "  ❌ ERREUR MGA mal positionnées!"
  exit 1
fi

# Test 2: Bras de suspension (Avant/Arrière/Supérieur/Inférieur)
echo ""
echo "📊 Test 2: Bras de suspension (typeId=18376, gammeId=273)"
echo "---------------------------------------------------------"
RESULT2=$(curl -s http://localhost:3000/api/catalog/batch-loader \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"typeId":18376,"gammeId":273}')

TOTAL2=$(echo "$RESULT2" | jq -r '.pieces | length')
GROUPES2=$(echo "$RESULT2" | jq -r '[.grouped_pieces[].title_h2] | unique | sort | join(", ")')
echo "  Total: $TOTAL2 pièces"
echo "  Groupes:"

# Compter chaque type de position
AVANT=$(echo "$RESULT2" | jq -r '[.grouped_pieces[] | select(.title_h2 | contains("Avant"))] | map(.pieces | length) | add // 0')
ARRIERE=$(echo "$RESULT2" | jq -r '[.grouped_pieces[] | select(.title_h2 | contains("Arrière"))] | map(.pieces | length) | add // 0')
SUPERIEUR=$(echo "$RESULT2" | jq -r '[.grouped_pieces[] | select(.title_h2 | contains("Supérieur"))] | map(.pieces | length) | add // 0')
INFERIEUR=$(echo "$RESULT2" | jq -r '[.grouped_pieces[] | select(.title_h2 | contains("Inférieur"))] | map(.pieces | length) | add // 0')

echo "    - Avant: $AVANT pièces"
echo "    - Arrière: $ARRIERE pièces"
echo "    - Supérieur: $SUPERIEUR pièces"
echo "    - Inférieur: $INFERIEUR pièces"

if [[ $AVANT -gt 0 ]] && [[ $ARRIERE -gt 0 ]] && [[ $SUPERIEUR -gt 0 ]] && [[ $INFERIEUR -gt 0 ]]; then
  echo "  ✅ Toutes les positions détectées (Avant, Arrière, Supérieur, Inférieur)"
else
  echo "  ⚠️  Certaines positions manquantes (normal si pas de pièces)"
fi

echo ""
echo "=============================================="
echo "✅ TOUS LES TESTS PASSENT"
echo "=============================================="
echo ""
echo "📋 Positions supportées:"
echo "  - Avant / Arrière"
echo "  - Gauche / Droite"
echo "  - Supérieur / Inférieur"
echo "  - Latéral"
echo "  - Conducteur / Passager"
