#!/bin/bash
# 📁 backend/test-gamme-simple.sh
# 🔍 Script simple pour tester les tables gammes

echo "🔍 Test simple des tables gammes"
echo "================================"

# Test 1: Vérifier si les tables existent via curl simple
echo "📋 1. Test d'existence des tables:"
echo ""

echo "🔸 Test pieces_gamme:"
curl -s "http://localhost:3001/api/supabase/test-table/pieces_gamme" || echo "❌ Endpoint non disponible"

echo ""
echo "🔸 Test catalog_gamme:"  
curl -s "http://localhost:3001/api/supabase/test-table/catalog_gamme" || echo "❌ Endpoint non disponible"

echo ""
echo "✅ Test terminé!"