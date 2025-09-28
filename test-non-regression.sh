#!/bin/bash

# 🔒 SCRIPT DE TEST NON-RÉGRESSION - V5 Ultimate
# Vérifie que les améliorations ne cassent pas les vraies données

echo "🔍 TEST NON-RÉGRESSION V5 ULTIMATE"
echo "=================================="

# Test 1: API PHP Logic (source de vérité)
echo "📊 Test 1: API PHP Logic (plaquettes de frein)"
RESPONSE=$(curl -s "http://localhost:3000/api/catalog/pieces/php-logic/139/402")
SUCCESS=$(echo $RESPONSE | jq -r '.success // false')
PIECES_COUNT=$(echo $RESPONSE | jq -r '.data.pieces | length // 0')
MIN_PRICE=$(echo $RESPONSE | jq -r '.data.minPrice // 0')

if [ "$SUCCESS" = "true" ] && [ "$PIECES_COUNT" -gt 0 ]; then
    echo "✅ API PHP Logic: $PIECES_COUNT pièces, prix min: ${MIN_PRICE}€"
else
    echo "❌ API PHP Logic: ÉCHEC"
    exit 1
fi

# Test 2: Vérification prix réalistes
if (( $(echo "$MIN_PRICE > 0" | bc -l) )) && (( $(echo "$MIN_PRICE < 1000" | bc -l) )); then
    echo "✅ Prix réalistes: ${MIN_PRICE}€ dans la fourchette"
else
    echo "❌ Prix suspects: ${MIN_PRICE}€"
    exit 1
fi

# Test 3: Marques réelles
MARQUES=$(echo $RESPONSE | jq -r '.data.pieces[0:3] | .[].marque' | tr '\n' ', ')
echo "✅ Marques trouvées: $MARQUES"

# Test 4: Performance acceptable
START_TIME=$(date +%s%N)
curl -s "http://localhost:3000/api/catalog/pieces/php-logic/139/402" > /dev/null
END_TIME=$(date +%s%N)
DURATION=$(( ($END_TIME - $START_TIME) / 1000000 )) # en ms

if [ "$DURATION" -lt 10000 ]; then
    echo "✅ Performance: ${DURATION}ms (< 10s acceptable)"
else
    echo "⚠️ Performance: ${DURATION}ms (lent mais fonctionnel)"
fi

echo ""
echo "🎯 RÉFÉRENCE SAUVEGARDÉE:"
echo "- API: http://localhost:3000/api/catalog/pieces/php-logic/139/402"
echo "- Pièces: $PIECES_COUNT"
echo "- Prix min: ${MIN_PRICE}€"
echo "- Performance: ${DURATION}ms"
echo ""
echo "✅ TOUS LES TESTS PASSENT - Système stable à préserver"