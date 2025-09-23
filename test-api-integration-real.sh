#!/bin/bash

# 🔍 Script de test intégration API réelle
echo "🔍 Test des APIs réelles disponibles sur le port 3000"
echo "=================================================="

echo ""
echo "📊 1. Test API Catalogue Gammes (FONCTIONNE)"
echo "----------------------------------------------"
curl -s "http://localhost:3000/api/catalog/gammes/all" | jq '.success, .count, .data[0:2]' 2>/dev/null || echo "❌ Erreur JSON"

echo ""
echo "🌟 2. Test API TOP Gammes"
echo "-------------------------"
curl -s "http://localhost:3000/api/catalog/gammes/top" | jq '.success, .stats' 2>/dev/null || echo "❌ Erreur JSON"

echo ""
echo "🏭 3. Test API Gammes par Fabricant"
echo "-----------------------------------"
curl -s "http://localhost:3000/api/catalog/gammes/by-manufacturer" | jq '.success, .manufacturers_count' 2>/dev/null || echo "❌ Erreur JSON"

echo ""
echo "🚗 4. Test APIs Véhicules (URLs à découvrir)"
echo "--------------------------------------------"
curl -s "http://localhost:3000/api/vehicles" | head -3
echo ""
curl -s "http://localhost:3000/api/catalog/vehicles" | head -3
echo ""

echo ""
echo "📍 5. Test autres endpoints possibles"
echo "-------------------------------------"
curl -s "http://localhost:3000/api/marques" | head -3
echo ""
curl -s "http://localhost:3000/api/brands" | head -3
echo ""

echo ""
echo "🔍 6. Structure de données gammes pour intégration"
echo "===================================================="
curl -s "http://localhost:3000/api/catalog/gammes/all" | jq '.data[0:5] | map({pg_id, pg_name, pg_alias, pg_image})' 2>/dev/null || echo "❌ Erreur JSON"

echo ""
echo "✅ Test terminé - Utiliser ces données pour l'intégration frontend"