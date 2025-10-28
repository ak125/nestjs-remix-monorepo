#!/bin/bash

# 🧪 Tests curl ultra-rapides
# Juste pour valider que le cookie fonctionne

URL="http://localhost:3000/pieces/pompe-de-direction-assistee-12.html"
COOKIE='selected_vehicle=%7B%22marque_id%22%3A140%2C%22marque_name%22%3A%22Renault%22%2C%22marque_alias%22%3A%22renault%22%2C%22modele_id%22%3A1234%2C%22modele_name%22%3A%22Avantime%22%2C%22modele_alias%22%3A%22avantime%22%2C%22type_id%22%3A5678%2C%22type_name%22%3A%222.0%2016V%22%2C%22type_alias%22%3A%222-0-16v%22%2C%22selected_at%22%3A%222025-10-28T10%3A00%3A00.000Z%22%7D'

echo "🧪 Test rapide curl"
echo ""

# Test 1: Sans cookie
echo "1️⃣  SANS cookie:"
curl -s "$URL" 2>/dev/null | grep -q "Renault Avantime"
if [ $? -eq 0 ]; then
    echo "   ❌ Véhicule détecté (ne devrait pas)"
else
    echo "   ✅ Pas de véhicule (correct)"
fi

# Test 2: Avec cookie
echo "2️⃣  AVEC cookie:"
curl -s -H "Cookie: $COOKIE" "$URL" 2>/dev/null | grep -q "Renault Avantime"
if [ $? -eq 0 ]; then
    echo "   ✅ Véhicule 'Renault Avantime' détecté (correct)"
else
    echo "   ❌ Véhicule non détecté (erreur)"
fi

echo ""
echo "✅ Tests terminés"
