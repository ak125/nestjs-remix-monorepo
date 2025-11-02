#!/bin/bash

# 🧪 Tests curl simplifiés pour fil d'ariane dynamique
# À exécuter quand le serveur est démarré (npm run dev)

BASE_URL="http://localhost:3000"
TEST_URL="$BASE_URL/pieces/pompe-de-direction-assistee-12.html"

echo "🧪 Tests curl - Fil d'ariane dynamique"
echo "======================================"
echo ""
echo "📍 URL: $TEST_URL"
echo ""

# Vérifier si le serveur répond
if ! curl -s --connect-timeout 3 "$BASE_URL" > /dev/null 2>&1; then
    echo "❌ ERREUR: Le serveur n'est pas accessible"
    echo ""
    echo "➡️  Démarrez le serveur avec:"
    echo "    cd frontend && npm run dev"
    echo ""
    exit 1
fi

echo "✅ Serveur accessible"
echo ""

# Cookie de test (Renault Avantime)
VEHICLE_COOKIE='selected_vehicle=%7B%22marque_id%22%3A140%2C%22marque_name%22%3A%22Renault%22%2C%22marque_alias%22%3A%22renault%22%2C%22modele_id%22%3A1234%2C%22modele_name%22%3A%22Avantime%22%2C%22modele_alias%22%3A%22avantime%22%2C%22type_id%22%3A5678%2C%22type_name%22%3A%222.0%2016V%22%2C%22type_alias%22%3A%222-0-16v%22%2C%22selected_at%22%3A%222025-10-28T10%3A00%3A00.000Z%22%7D'

# Test 1: Sans cookie
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST 1: Sans cookie (3 niveaux)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

curl -s "$TEST_URL" | grep -A 5 'aria-label="Breadcrumb"' | head -20

echo ""
echo ""

# Test 2: Avec cookie
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST 2: Avec cookie (4 niveaux)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

curl -s -H "Cookie: $VEHICLE_COOKIE" "$TEST_URL" | grep -A 5 'aria-label="Breadcrumb"' | head -20

echo ""
echo ""

# Test rapide de comparaison
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Comparaison rapide"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SANS_COOKIE=$(curl -s "$TEST_URL" | grep -o '<a[^>]*>' | wc -l)
AVEC_COOKIE=$(curl -s -H "Cookie: $VEHICLE_COOKIE" "$TEST_URL" | grep -o 'Renault Avantime' | wc -l)

echo "Nombre de liens breadcrumb SANS cookie: $SANS_COOKIE"
echo "Présence 'Renault Avantime' AVEC cookie: $AVEC_COOKIE occurrence(s)"
echo ""

if [ "$AVEC_COOKIE" -gt 0 ]; then
    echo "✅ Le véhicule est bien ajouté au breadcrumb avec cookie"
else
    echo "⚠️  Le véhicule n'a pas été détecté dans le breadcrumb"
fi

echo ""
echo "✅ Tests terminés"
echo ""
