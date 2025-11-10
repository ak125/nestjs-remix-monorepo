#!/bin/bash

# 🚀 Script pour déployer les fonctions SQL optimisées dans Supabase
# Usage: ./scripts/deploy-sql-functions.sh

set -e

echo "🚀 Déploiement des fonctions SQL optimisées..."

# Charger les variables d'environnement
if [ -f ../.env ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
fi

# Vérifier que les variables sont définies
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non défini"
    exit 1
fi

# Extraire l'ID du projet depuis l'URL
PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\///' | sed 's/.supabase.co//')

echo "📍 Projet Supabase: $PROJECT_REF"
echo "📁 Déploiement de: get_catalog_hierarchy_optimized.sql"

# Lire le fichier SQL
SQL_CONTENT=$(cat sql/get_catalog_hierarchy_optimized.sql)

# Exécuter via l'API Supabase
curl -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/execute_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}"

echo ""
echo "✅ Fonction SQL déployée avec succès!"
echo ""
echo "Test de la fonction:"
curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/get_catalog_hierarchy_optimized" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  | jq '. | length'

echo "📊 Lignes retournées ci-dessus"
