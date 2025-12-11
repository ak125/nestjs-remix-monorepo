#!/bin/bash

# Script de test de performance pour l'endpoint optimisÃ©

echo "ðŸš€ Test de performance - Endpoint /api/gamme-rest-optimized/402"
echo "================================================================"

# Attendre que le serveur soit prÃªt
echo "â³ Attente du serveur..."
sleep 10

# Test 1: PremiÃ¨re requÃªte
echo ""
echo "ðŸ“Š Test 1: PremiÃ¨re requÃªte"
start=$(date +%s%N)
response=$(curl -s "http://localhost:3001/api/gamme-rest-optimized/402")
end=$(date +%s%N)
duration=$((($end - $start) / 1000000))

motorisations=$(echo "$response" | jq '.motorisations | length' 2>/dev/null || echo "ERROR")
echo "   âœ… Temps total: ${duration}ms"
echo "   ðŸ“¦ Motorisations: $motorisations"

# Test 2: DeuxiÃ¨me requÃªte
echo ""
echo "ðŸ“Š Test 2: DeuxiÃ¨me requÃªte"
start=$(date +%s%N)
response=$(curl -s "http://localhost:3001/api/gamme-rest-optimized/402")
end=$(date +%s%N)
duration=$((($end - $start) / 1000000))

motorisations=$(echo "$response" | jq '.motorisations | length' 2>/dev/null || echo "ERROR")
echo "   âœ… Temps total: ${duration}ms"
echo "   ðŸ“¦ Motorisations: $motorisations"

# Test 3: TroisiÃ¨me requÃªte
echo ""
echo "ðŸ“Š Test 3: TroisiÃ¨me requÃªte"
start=$(date +%s%N)
response=$(curl -s "http://localhost:3001/api/gamme-rest-optimized/402")
end=$(date +%s%N)
duration=$((($end - $start) / 1000000))

motorisations=$(echo "$response" | jq '.motorisations | length' 2>/dev/null || echo "ERROR")
echo "   âœ… Temps total: ${duration}ms"
echo "   ðŸ“¦ Motorisations: $motorisations"

echo ""
echo "================================================================"
echo "âœ… Tests terminÃ©s!"
