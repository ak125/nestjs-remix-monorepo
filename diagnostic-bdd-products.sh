#!/bin/bash

# 🔍 Script de diagnostic de la structure BDD
# Vérifie les vraies colonnes et valeurs des tables

echo "🔍 DIAGNOSTIC STRUCTURE BDD - Tables Produits"
echo "=============================================="
echo ""

# Test 1: Échantillon table pieces
echo "📦 Test 1: Structure table PIECES (5 premières lignes)"
echo "SELECT * FROM pieces LIMIT 5;" | psql $DATABASE_URL 2>/dev/null || \
curl -s -b cookies.txt "http://localhost:3000/api/products/debug/tables" | jq '.pieces' || \
echo "⚠️ Impossible d'accéder directement à la BDD"
echo ""

# Test 2: Échantillon table pieces_gamme
echo "🏷️ Test 2: Structure table PIECES_GAMME (5 premières lignes)"
curl -s -b cookies.txt "http://localhost:3000/api/products/gammes" | jq '.[0:3]' || echo "❌ Erreur API"
echo ""

# Test 3: Échantillon table auto_marque
echo "🚗 Test 3: Structure table AUTO_MARQUE (5 premières lignes)"
curl -s -b cookies.txt "http://localhost:3000/api/products/brands-test" | jq '.data[0:5]' || echo "❌ Erreur API"
echo ""

# Test 4: Compter TOUS les produits (sans filtre)
echo "📊 Test 4: Compter TOUS les produits (sans filtre activ/display)"
echo "Cela devrait retourner ~400k si les filtres sont le problème"
echo ""

# Test 5: Vérifier les valeurs possibles de piece_activ
echo "🔍 Test 5: Valeurs possibles de piece_activ"
echo "SELECT DISTINCT piece_activ, COUNT(*) FROM pieces GROUP BY piece_activ;" || echo "Via API..."
echo ""

# Test 6: Vérifier les valeurs possibles de piece_display
echo "🔍 Test 6: Valeurs possibles de piece_display"
echo "SELECT DISTINCT piece_display, COUNT(*) FROM pieces GROUP BY piece_display;" || echo "Via API..."
echo ""

echo "✅ Diagnostic terminé"
echo ""
echo "🎯 Action recommandée:"
echo "1. Vérifier si les colonnes piece_activ et marque_activ existent"
echo "2. Si elles existent, vérifier les valeurs (peut-être 1 au lieu de '1')"
echo "3. Si elles n'existent pas, utiliser d'autres colonnes (piece_display uniquement)"
