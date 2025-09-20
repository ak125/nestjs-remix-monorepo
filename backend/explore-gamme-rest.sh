#!/bin/bash
# 📁 backend/explore-gamme-rest.sh
# 🔍 Script REST pour explorer les tables gammes dans Supabase

echo "🔍 Exploration des tables gammes via REST API..."
echo "=============================================="

# Variables (à ajuster selon votre configuration)
SUPABASE_URL="${SUPABASE_URL:-your-supabase-url}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-supabase-key}"

# Function pour faire des requêtes REST
make_request() {
  local table=$1
  local limit=${2:-3}
  
  echo "📋 Test de la table: $table"
  echo "-----------------------------"
  
  curl -s \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    "$SUPABASE_URL/rest/v1/$table?limit=$limit" | jq '.' 2>/dev/null || echo "❌ Erreur ou table non trouvée"
  
  echo ""
}

# 1. Test table pieces_gamme
echo "🔍 1. Exploration de pieces_gamme"
make_request "pieces_gamme" 2

# 2. Test table catalog_gamme  
echo "🔍 2. Exploration de catalog_gamme"
make_request "catalog_gamme" 2

# 3. Test table products_gamme (au cas où)
echo "🔍 3. Test products_gamme (si elle existe)"
make_request "products_gamme" 1

# 4. Compter les enregistrements
echo "📊 4. Comptage des enregistrements"
echo "================================="

echo "📦 Nombre d'enregistrements dans pieces_gamme:"
curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Prefer: count=exact" \
  "$SUPABASE_URL/rest/v1/pieces_gamme?select=count" | jq '.' 2>/dev/null || echo "❌ Erreur comptage"

echo ""
echo "📂 Nombre d'enregistrements dans catalog_gamme:"
curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Prefer: count=exact" \
  "$SUPABASE_URL/rest/v1/catalog_gamme?select=count" | jq '.' 2>/dev/null || echo "❌ Erreur comptage"

echo ""
echo "✅ Exploration terminée!"