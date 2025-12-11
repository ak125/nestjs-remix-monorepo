#!/bin/bash

# ðŸš€ Script pour dÃ©ployer les fonctions SQL optimisÃ©es dans Supabase
# Usage: ./scripts/deploy-sql-functions.sh

set -e

echo "ðŸš€ DÃ©ploiement des fonctions SQL optimisÃ©es..."

# Charger les variables d'environnement
if [ -f ../.env ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
fi

# VÃ©rifier que les variables sont dÃ©finies
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "âŒ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non dÃ©fini"
    exit 1
fi

# Extraire l'ID du projet depuis l'URL
PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\///' | sed 's/.supabase.co//')

echo "ðŸ“ Projet Supabase: $PROJECT_REF"
echo "ðŸ“ DÃ©ploiement de: get_catalog_hierarchy_optimized.sql"

# Lire le fichier SQL
SQL_CONTENT=$(cat sql/get_catalog_hierarchy_optimized.sql)

# ExÃ©cuter via l'API Supabase
curl -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/execute_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}"

echo ""
echo "âœ… Fonction SQL dÃ©ployÃ©e avec succÃ¨s!"
echo ""
echo "Test de la fonction:"
curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/get_catalog_hierarchy_optimized" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  | jq '. | length'

echo "ðŸ“Š Lignes retournÃ©es ci-dessus"
