#!/bin/bash

# Script de test pour l'endpoint bestsellers
# Usage: ./test-bestsellers-endpoint.sh

BASE_URL="http://localhost:3000/api/manufacturers/brand"

echo "ðŸ§ª TEST ENDPOINT BESTSELLERS"
echo "================================"
echo ""

echo "1ï¸âƒ£  Test BMW (5 vÃ©hicules, 5 piÃ¨ces)"
echo "-----------------------------------"
curl -s "${BASE_URL}/bmw/bestsellers?limitVehicles=5&limitParts=5" | jq '.meta'
echo ""

echo "2ï¸âƒ£  Test Renault (3 vÃ©hicules, 3 piÃ¨ces)"
echo "---------------------------------------"
curl -s "${BASE_URL}/renault/bestsellers?limitVehicles=3&limitParts=3" | jq '.meta'
echo ""

echo "3ï¸âƒ£  Test Peugeot (10 vÃ©hicules, 0 piÃ¨ces)"
echo "-----------------------------------------"
curl -s "${BASE_URL}/peugeot/bestsellers?limitVehicles=10&limitParts=0" | jq '.meta'
echo ""

echo "4ï¸âƒ£  Test Performance Cache (BMW)"
echo "---------------------------------"
echo "PremiÃ¨re requÃªte (DB):"
time curl -s "${BASE_URL}/bmw/bestsellers?limitVehicles=12&limitParts=12" > /dev/null

echo ""
echo "DeuxiÃ¨me requÃªte (Cache Redis):"
time curl -s "${BASE_URL}/bmw/bestsellers?limitVehicles=12&limitParts=12" > /dev/null

echo ""
echo "5ï¸âƒ£  Test Marque Invalide"
echo "------------------------"
curl -s "${BASE_URL}/marque-inexistante/bestsellers" | jq '.success, .error'
echo ""

echo "âœ… Tests terminÃ©s!"
