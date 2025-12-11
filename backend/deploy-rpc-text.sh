#!/bin/bash
set -e

echo "ðŸš€ DÃ‰PLOIEMENT VIA API REST SUPABASE"
echo ""

source .env

SQL_CONTENT=$(cat prisma/supabase-functions/get_gamme_page_data_optimized_TEXT.sql)

echo "ðŸ“¡ ExÃ©cution du SQL via l'API Supabase..."

# Utiliser l'endpoint SQL de Supabase
curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(jq -Rs . < prisma/supabase-functions/get_gamme_page_data_optimized_TEXT.sql)}" \
  | jq '.'

echo ""
echo "â³ Attente 3s pour propagation..."
sleep 3

echo ""
echo "ðŸ§ª Test de la fonction avec p_pg_id TEXT..."
curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/get_gamme_page_data_optimized" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"p_pg_id": "10"}' \
  | jq -c 'if .message then {error: .message, code} else {success: true, has_catalog: (.catalog != null), has_seo: (.seo != null)} end'

echo ""
echo ""
echo "ðŸ§ª Test via NestJS endpoint..."
curl -s http://localhost:3000/api/gamme-rest-optimized/10/page-data-rpc-v2 \
  | jq -c 'if .error then {error, message} else {success: true, meta_title: .meta.title[0:50]} end'

echo ""
echo "âœ… DÃ©ploiement terminÃ©"
