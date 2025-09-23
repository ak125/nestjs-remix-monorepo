#!/bin/bash

# 🧪 Script de test des pages constructeurs
# Vérifie que les pages se chargent correctement

echo "🧪 Test des pages constructeurs..."

# Configuration
BASE_URL="http://localhost:3000"
BRAND="bmw"
MODEL="serie-1-f20" 
TYPE="2-0-125-d"

echo "📋 URLs à tester:"
echo "1. Page constructeur: ${BASE_URL}/constructeurs/${BRAND}"
echo "2. Page véhicule: ${BASE_URL}/constructeurs/${BRAND}/${MODEL}/${TYPE}.html"
echo ""

# Test 1: Page constructeur
echo "🔍 Test 1: Page constructeur BMW..."
response1=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/constructeurs/${BRAND}")

if [ "$response1" = "200" ]; then
    echo "✅ Page constructeur BMW: OK (200)"
else
    echo "❌ Page constructeur BMW: Erreur ($response1)"
fi

# Test 2: Page véhicule
echo "🔍 Test 2: Page véhicule BMW Série 1..."
response2=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/constructeurs/${BRAND}/${MODEL}/${TYPE}.html")

if [ "$response2" = "200" ]; then
    echo "✅ Page véhicule BMW Série 1: OK (200)"
else
    echo "❌ Page véhicule BMW Série 1: Erreur ($response2)"
fi

echo ""
echo "📊 Résumé des tests:"
echo "- Page constructeur: $response1"
echo "- Page véhicule: $response2"

if [ "$response1" = "200" ] && [ "$response2" = "200" ]; then
    echo "🎉 Tous les tests sont passés !"
    exit 0
else
    echo "💥 Certains tests ont échoué"
    exit 1
fi