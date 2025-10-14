#!/bin/bash

# 🧪 Script de test des statistiques produits
# Vérifie que les comptages correspondent aux filtres appliqués

echo "🔍 Test des statistiques produits..."
echo ""

# Attendre que le backend soit prêt
sleep 2

# Test 1: Statistiques globales
echo "📊 Test 1: Statistiques globales"
curl -s -b cookies.txt http://localhost:3000/api/admin/products/stats/detailed | jq '.stats' || echo "❌ Erreur API"
echo ""

# Test 2: Compter manuellement les produits actifs
echo "📝 Test 2: Vérification manuelle via SQL (si Supabase CLI disponible)"
echo "SELECT COUNT(*) FROM pieces WHERE piece_activ = '1' AND piece_display = true;"
echo ""

# Test 3: Liste quelques produits pour vérifier les valeurs
echo "📦 Test 3: Échantillon de produits"
curl -s -b cookies.txt "http://localhost:3000/api/admin/products?limit=5" | jq '.data[0:3]' || echo "❌ Erreur API"
echo ""

# Test 4: Vérifier les gammes
echo "🏷️ Test 4: Compter les gammes actives"
curl -s -b cookies.txt http://localhost:3000/api/products/gammes | jq '.count' || echo "❌ Erreur API"
echo ""

# Test 5: Vérifier les marques
echo "🚗 Test 5: Compter les marques actives"
curl -s -b cookies.txt http://localhost:3000/api/products/brands | jq '.count' || echo "❌ Erreur API"
echo ""

echo "✅ Tests terminés"
