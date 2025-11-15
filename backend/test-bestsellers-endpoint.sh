#!/bin/bash

# Script de test pour l'endpoint bestsellers
# Usage: ./test-bestsellers-endpoint.sh

BASE_URL="http://localhost:3000/api/manufacturers/brand"

echo "🧪 TEST ENDPOINT BESTSELLERS"
echo "================================"
echo ""

echo "1️⃣  Test BMW (5 véhicules, 5 pièces)"
echo "-----------------------------------"
curl -s "${BASE_URL}/bmw/bestsellers?limitVehicles=5&limitParts=5" | jq '.meta'
echo ""

echo "2️⃣  Test Renault (3 véhicules, 3 pièces)"
echo "---------------------------------------"
curl -s "${BASE_URL}/renault/bestsellers?limitVehicles=3&limitParts=3" | jq '.meta'
echo ""

echo "3️⃣  Test Peugeot (10 véhicules, 0 pièces)"
echo "-----------------------------------------"
curl -s "${BASE_URL}/peugeot/bestsellers?limitVehicles=10&limitParts=0" | jq '.meta'
echo ""

echo "4️⃣  Test Performance Cache (BMW)"
echo "---------------------------------"
echo "Première requête (DB):"
time curl -s "${BASE_URL}/bmw/bestsellers?limitVehicles=12&limitParts=12" > /dev/null

echo ""
echo "Deuxième requête (Cache Redis):"
time curl -s "${BASE_URL}/bmw/bestsellers?limitVehicles=12&limitParts=12" > /dev/null

echo ""
echo "5️⃣  Test Marque Invalide"
echo "------------------------"
curl -s "${BASE_URL}/marque-inexistante/bestsellers" | jq '.success, .error'
echo ""

echo "✅ Tests terminés!"
